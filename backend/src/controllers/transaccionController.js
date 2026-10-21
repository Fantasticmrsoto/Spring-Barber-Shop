const db = require('../config/db');
const { errorInterno } = require('../utils/respuestaError');
const { idValido } = require('../utils/validacion');
const { rutaPublica } = require('../config/subidas');

/*
 * Transacciones: pagos de cita y movimientos de saldo.
 *
 * La tabla `transacciones` guarda las dos cosas:
 *
 *   - **Pago de cita** (`citaID`): lo que el cliente paga por una reserva. El
 *     administrador cobra en el local (efectivo o tarjeta) y queda
 *     `completado`; el cliente que paga por pago móvil sube un comprobante y
 *     queda `pendiente` hasta que el administrador lo aprueba o lo rechaza.
 *   - **Movimiento de saldo** (`tipo_movimiento`): el libro de saldos que usa
 *     el modelo de la barbería para Prepago.
 *
 * Las dos formas conviven en la misma tabla porque el modelo de negocio las
 * necesita juntas, y porque los movimientos de saldo ya estaban en marcha.
 */

// Métodos de pago que admite la columna `transacciones.metodo_pago`.
const METODOS_PAGO = ['efectivo', 'tarjeta', 'pago_movil'];

/*
 * Consulta de la lista.
 *
 * Los JOIN son a propósito LEFT: un movimiento de saldo no tiene cita, y una
 * cita de invitado no tiene cliente registrado. Con INNER JOIN, esas filas
 * desaparecerían del listado del administrador justo cuando las necesita ver.
 */
const SELECT_TRANSACCION = `
  SELECT
    t."transaccionID",
    t."citaID",
    t.metodo_pago,
    t.estado,
    t.monto,
    t.referencia_pago,
    t.comprobante_url,
    t.motivo_rechazo,
    t.fecha_creacion,
    t.tipo_movimiento,
    t.saldo_restante,
    c.fecha_inicio,
    COALESCE(c.es_invitado, false) AS es_invitado,
    c.contacto_nombre,
    c.contacto_telefono,
    s.nombre  AS servicio_nombre,
    COALESCE(c.contacto_nombre, uc.nombre, uu.nombre)   AS cliente_nombre,
    COALESCE(uc.apellido, uu.apellido)                 AS cliente_apellido,
    ub.nombre   AS barbero_nombre,
    ub.apellido AS barbero_apellido
  FROM transacciones t
  LEFT JOIN cita c     ON c."citaID"     = t."citaID"
  LEFT JOIN usuario uc ON uc."usuarioID" = c."clienteID"
  LEFT JOIN servicios s ON s."serviciosID" = c."servicioID"
  LEFT JOIN barbero b   ON b."barberoID"   = c."barberoID"
  LEFT JOIN usuario ub  ON ub."usuarioID"  = b."usuarioID"
  LEFT JOIN usuario uu  ON uu."usuarioID"  = t."usuarioID"
`;

/**
 * Da forma a una fila de la consulta para la respuesta de la API.
 * @param {object} fila
 */
const formatearTransaccion = (fila) => ({
  ...fila,
  monto: fila.monto === null ? null : Number(fila.monto),
  saldo_restante: fila.saldo_restante === null ? null : Number(fila.saldo_restante),
  // El saldo solo tiene sentido en los movimientos de saldo.
  tipo_movimiento: fila.tipo_movimiento ?? null,
  saldo_restante_es_movimiento: fila.tipo_movimiento !== null,
});

// 1. Listar transacciones
//
// El administrador las ve todas; un cliente, solo las suyas: las de sus citas
// y sus propios movimientos de saldo.
const obtenerTransacciones = async (req, res) => {
  const esAdmin = req.usuario?.rol === 'administrador';

  try {
    let resultado;

    if (esAdmin) {
      resultado = await db.query(`${SELECT_TRANSACCION} ORDER BY t."transaccionID" DESC;`);
    } else {
      const usuarioId = req.usuario?.usuarioID;
      resultado = await db.query(
        `${SELECT_TRANSACCION}
         WHERE t."usuarioID" = $1
            OR c."clienteID" = $1
         ORDER BY t."transaccionID" DESC;`,
        [usuarioId]
      );
    }

    res.json({
      ok: true,
      total: resultado.rows.length,
      transacciones: resultado.rows.map(formatearTransaccion)
    });
  } catch (error) {
    errorInterno(res, error, 'Obtener Transacciones');
  }
};

// 2. Registrar una transacción
//
// Según lo que llegue en el cuerpo, es un pago de cita o un movimiento de
// saldo. Se distinguen por el `citaID`: si viene, es un pago.
const crearTransaccion = async (req, res) => {
  const body = req.body || {};

  if (body.citaID !== undefined && body.citaID !== null && body.citaID !== '') {
    return crearPago(req, res);
  }

  return crearMovimientoSaldo(req, res);
};

/*
 * 2a. Pago de una cita
 *
 * Hay dos caminos:
 *   - El administrador cobra en el local (efectivo o tarjeta): queda
 *     `completado` directamente.
 *   - El cliente paga por pago móvil: sube un comprobante y una referencia,
 *     y queda `pendiente` hasta que el administrador lo revise.
 */
const crearPago = async (req, res) => {
  const { citaID, metodo_pago, referencia_pago, monto } = req.body || {};
  const esAdmin = req.usuario?.rol === 'administrador';
  const citaId = idValido(citaID);

  if (!citaId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID de la cita debe ser un número entero válido'
    });
  }

  const metodo = metodo_pago === undefined || metodo_pago === null || metodo_pago === ''
    ? 'efectivo'
    : metodo_pago;

  if (!METODOS_PAGO.includes(metodo)) {
    return res.status(400).json({
      ok: false,
      message: `El método de pago debe ser uno de: ${METODOS_PAGO.join(', ')}`
    });
  }

  // El comprobante llega como archivo (multipart) o como URL ya subida.
  const comprobante = req.file ? rutaPublica(req.file.filename) : (req.body?.comprobante_url || null);
  const referencia = typeof referencia_pago === 'string' ? referencia_pago.trim() : '';

  // El pago móvil sin referencia no se puede revisar después: sin el número
  // de la operación no hay forma de comprobar el cobro.
  if (metodo === 'pago_movil' && !referencia) {
    return res.status(400).json({
      ok: false,
      message: 'El pago móvil necesita una referencia de pago'
    });
  }

  try {
    const cita = await db.query(
      `SELECT c."citaID", c.estado, c."clienteID", s.precio
       FROM cita c
       JOIN servicios s ON s."serviciosID" = c."servicioID"
       WHERE c."citaID" = $1`,
      [citaId]
    );

    if (cita.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cita no encontrada' });
    }

    const { precio, clienteID } = cita.rows[0];

    // Un cliente solo puede pagar sus propias citas. El administrador puede
    // pagar cualquiera (es el que cobra en el mostrador).
    if (!esAdmin && clienteID !== req.usuario?.usuarioID) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para registrar el pago de esta cita'
      });
    }

    const montoNumero = monto === undefined || monto === null || monto === '' ? Number(precio) : Number(monto);

    if (!Number.isFinite(montoNumero) || montoNumero < 0 || montoNumero > 99999999.99) {
      return res.status(400).json({
        ok: false,
        message: 'El monto debe ser un número no negativo'
      });
    }

    // Lo que se cobra en el local está pagado; lo que llega por pago móvil
    // queda pendiente de la revisión del administrador.
    const estado = metodo === 'pago_movil' ? 'pendiente' : 'completado';

    const resultado = await db.query(
      `INSERT INTO transacciones
         ("citaID", "usuarioID", metodo_pago, estado, monto, referencia_pago, comprobante_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING "transaccionID", "citaID", metodo_pago, estado, monto, referencia_pago, comprobante_url, fecha_creacion;`,
      [citaId, clienteID, metodo, estado, montoNumero, referencia || null, comprobante]
    );

    res.status(201).json({
      ok: true,
      message: 'Pago registrado exitosamente',
      transaccion: {
        ...resultado.rows[0],
        monto: Number(resultado.rows[0].monto),
      }
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ ok: false, message: 'La cita indicada no existe' });
    }
    errorInterno(res, error, 'Crear Pago');
  }
};

/*
 * 2b. Movimiento de saldo
 *
 * El libro de saldos: recargas y consumos del saldo de prepago de un cliente.
 */
const crearMovimientoSaldo = async (req, res) => {
  const { usuarioID, tipo_movimiento, monto, saldo_restante, referencia_pago } = req.body || {};

  const usuarioId = Number(usuarioID);
  const montoNum = Number(monto);
  const saldoNum = Number(saldo_restante);
  const tipo = typeof tipo_movimiento === 'string' ? tipo_movimiento.trim() : '';
  const referencia = typeof referencia_pago === 'string' ? referencia_pago.trim() : '';

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'usuarioID debe ser un número entero válido'
    });
  }
  if (!tipo) {
    return res.status(400).json({
      ok: false,
      message: 'tipo_movimiento es obligatorio'
    });
  }
  if (!Number.isFinite(montoNum)) {
    return res.status(400).json({
      ok: false,
      message: 'monto debe ser un número'
    });
  }
  if (!Number.isFinite(saldoNum)) {
    return res.status(400).json({
      ok: false,
      message: 'saldo_restante debe ser un número'
    });
  }
  // referencia_pago es NOT NULL en el esquema. La vacía se guarda como texto
  // vacío en lugar de null, que rechazaría la base con 23502.
  if (!referencia) {
    return res.status(400).json({
      ok: false,
      message: 'referencia_pago es obligatoria'
    });
  }

  try {
    // Verificar que el usuario exista
    const usuarioRes = await db.query(
      'SELECT "usuarioID" FROM usuario WHERE "usuarioID" = $1',
      [usuarioId]
    );
    if (usuarioRes.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    const query = `
      INSERT INTO transacciones ("usuarioID", tipo_movimiento, monto, saldo_restante, referencia_pago)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING "transaccionID", "usuarioID", tipo_movimiento, monto, saldo_restante, referencia_pago, fecha_creacion;
    `;
    const resultado = await db.query(query, [usuarioId, tipo, montoNum, saldoNum, referencia]);

    res.status(201).json({
      ok: true,
      message: 'Transacción registrada exitosamente',
      transaccion: {
        ...resultado.rows[0],
        monto: Number(resultado.rows[0].monto),
        saldo_restante: Number(resultado.rows[0].saldo_restante),
      }
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ ok: false, message: 'El usuario indicado no existe' });
    }
    if (error.code === '23502') {
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios de la transacción' });
    }
    if (error.code === '22003') {
      return res.status(400).json({ ok: false, message: 'monto o saldo_restante fuera de rango' });
    }
    errorInterno(res, error, 'Crear Transaccion');
  }
};

// 3. Ver una transacción
const obtenerTransaccion = async (req, res) => {
  const transaccionId = idValido(req.params.id);

  if (!transaccionId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID de la transacción debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(
      `${SELECT_TRANSACCION} WHERE t."transaccionID" = $1`,
      [transaccionId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Transacción no encontrada' });
    }

    res.json({
      ok: true,
      transaccion: formatearTransaccion(resultado.rows[0])
    });
  } catch (error) {
    errorInterno(res, error, 'Obtener Transaccion');
  }
};

// 4. Aprobar un pago pendiente
const aprobarTransaccion = async (req, res) => {
  const transaccionId = idValido(req.params.id);

  if (!transaccionId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID de la transacción debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(
      `UPDATE transacciones
       SET estado = 'completado', motivo_rechazo = NULL
       WHERE "transaccionID" = $1
       RETURNING "transaccionID", "citaID", metodo_pago, estado, monto, referencia_pago, comprobante_url, fecha_creacion;`,
      [transaccionId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Transacción no encontrada' });
    }

    res.json({
      ok: true,
      message: 'Pago aprobado exitosamente',
      transaccion: {
        ...resultado.rows[0],
        monto: Number(resultado.rows[0].monto),
      }
    });
  } catch (error) {
    errorInterno(res, error, 'Aprobar Transaccion');
  }
};

// 5. Rechazar un pago pendiente
const rechazarTransaccion = async (req, res) => {
  const transaccionId = idValido(req.params.id);
  const { motivo } = req.body || {};

  if (!transaccionId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID de la transacción debe ser un número entero válido'
    });
  }

  const motivoTexto = typeof motivo === 'string' ? motivo.trim() : '';

  if (!motivoTexto) {
    return res.status(400).json({
      ok: false,
      message: 'El motivo del rechazo es obligatorio'
    });
  }

  try {
    const resultado = await db.query(
      `UPDATE transacciones
       SET estado = 'rechazado', motivo_rechazo = $2
       WHERE "transaccionID" = $1
       RETURNING "transaccionID", "citaID", metodo_pago, estado, monto, referencia_pago, comprobante_url, motivo_rechazo, fecha_creacion;`,
      [transaccionId, motivoTexto]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Transacción no encontrada' });
    }

    res.json({
      ok: true,
      message: 'Pago rechazado exitosamente',
      transaccion: {
        ...resultado.rows[0],
        monto: Number(resultado.rows[0].monto),
      }
    });
  } catch (error) {
    errorInterno(res, error, 'Rechazar Transaccion');
  }
};

module.exports = {
  obtenerTransacciones,
  crearTransaccion,
  obtenerTransaccion,
  aprobarTransaccion,
  rechazarTransaccion
};
