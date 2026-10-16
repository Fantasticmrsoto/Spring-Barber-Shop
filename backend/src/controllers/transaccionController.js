const db = require('../config/db');

// Módulo de pagos (migración 011). `transacciones` registra el pago de una cita:
//   - pago_movil: lo sube el cliente con su comprobante y queda 'pendiente' hasta
//     que el administrador lo aprueba o rechaza.
//   - efectivo / tarjeta: los registra el administrador en el local y quedan
//     'completado' directamente.

const METODOS = ['pago_movil', 'efectivo', 'tarjeta'];
const ESTADOS = ['pendiente', 'completado', 'rechazado'];

// Filas de pago con los datos que consume la interfaz (cliente, cita, servicio, barbero).
const SELECT_PAGO = `
  SELECT
    t."transaccionID",
    t."usuarioID",
    t.monto,
    t."referencia_pago",
    t.estado,
    t.metodo_pago,
    t.comprobante_url,
    t."motivo_rechazo",
    t."citaID",
    t.fecha_creacion,
    u.nombre   AS usuario_nombre,
    u.apellido AS usuario_apellido,
    u.correo   AS usuario_correo,
    to_char(c.fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inicio,
    c.estado AS cita_estado,
    c."clienteID",
    (c."clienteID" IS NULL) AS es_invitado,
    COALESCE(uc.nombre, c.contacto_nombre, 'Invitado') AS cliente_nombre,
    COALESCE(uc.apellido, '') AS cliente_apellido,
    s.nombre AS servicio_nombre,
    s.precio AS servicio_precio,
    ub.nombre   AS barbero_nombre,
    ub.apellido AS barbero_apellido
  FROM transacciones t
  JOIN usuario u ON t."usuarioID" = u."usuarioID"
  LEFT JOIN cita c ON t."citaID" = c."citaID"
  LEFT JOIN usuario uc ON c."clienteID" = uc."usuarioID"
  LEFT JOIN servicios s ON c."servicioID" = s."serviciosID"
  LEFT JOIN barbero b ON c."barberoID" = b."barberoID"
  LEFT JOIN usuario ub ON b."usuarioID" = ub."usuarioID"
`;

const buscarPago = async (transaccionID) => {
  const res = await db.query(`${SELECT_PAGO} WHERE t."transaccionID" = $1`, [transaccionID]);
  return res.rows[0] || null;
};

// 1. Listar pagos. El administrador ve todos; el cliente solo los suyos.
const obtenerTransacciones = async (req, res) => {
  const { usuarioID, rol } = req.usuario;

  const condiciones = [];
  const params = [];

  if (rol === 'cliente') {
    params.push(usuarioID);
    condiciones.push(`t."usuarioID" = $${params.length}`);
  }

  const estado = typeof req.query.estado === 'string' ? req.query.estado.trim() : '';
  if (estado) {
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ ok: false, message: 'estado no válido' });
    }
    params.push(estado);
    condiciones.push(`t.estado = $${params.length}`);
  }

  const metodo = typeof req.query.metodo_pago === 'string' ? req.query.metodo_pago.trim() : '';
  if (metodo) {
    if (!METODOS.includes(metodo)) {
      return res.status(400).json({ ok: false, message: 'metodo_pago no válido' });
    }
    params.push(metodo);
    condiciones.push(`t.metodo_pago = $${params.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  try {
    const resultado = await db.query(
      `${SELECT_PAGO} ${where} ORDER BY t."transaccionID" DESC`,
      params
    );
    res.json({
      ok: true,
      total: resultado.rows.length,
      transacciones: resultado.rows
    });
  } catch (error) {
    console.error('Error al obtener pagos:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 2. Detalle de un pago. El cliente solo puede ver los suyos.
const obtenerTransaccionPorId = async (req, res) => {
  const transaccionId = Number(req.params.id);
  if (!Number.isInteger(transaccionId) || transaccionId <= 0) {
    return res.status(400).json({ ok: false, message: 'ID de pago no válido' });
  }

  try {
    const pago = await buscarPago(transaccionId);
    if (!pago) return res.status(404).json({ ok: false, message: 'Pago no encontrado' });

    if (req.usuario.rol === 'cliente' && pago.usuarioID !== req.usuario.usuarioID) {
      return res.status(403).json({ ok: false, message: 'No tienes permiso para ver este pago' });
    }

    res.json({ ok: true, transaccion: pago });
  } catch (error) {
    console.error('Error al obtener el pago:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 3. Registrar el pago de una cita.
//    - Cliente: solo pago móvil con comprobante, sobre una cita propia -> 'pendiente'.
//    - Administrador: efectivo/tarjeta en el local -> 'completado' (y también pago móvil).
const crearTransaccion = async (req, res) => {
  const { usuarioID: solicitante, rol } = req.usuario;
  const { citaID, metodo_pago, referencia_pago, monto } = req.body || {};

  const citaId = Number(citaID);
  const metodo = typeof metodo_pago === 'string' ? metodo_pago.trim() : '';
  const referencia = typeof referencia_pago === 'string' ? referencia_pago.trim() : '';

  if (!Number.isInteger(citaId) || citaId <= 0) {
    return res.status(400).json({ ok: false, message: 'citaID debe ser un número entero válido' });
  }
  if (!METODOS.includes(metodo)) {
    return res.status(400).json({
      ok: false,
      message: 'metodo_pago debe ser pago_movil, efectivo o tarjeta'
    });
  }
  // Efectivo/tarjeta solo los registra el personal (pago presencial en el local).
  if (rol !== 'administrador' && metodo !== 'pago_movil') {
    return res.status(403).json({
      ok: false,
      message: 'Solo el administrador puede registrar pagos en efectivo o con tarjeta'
    });
  }

  try {
    const citaRes = await db.query(
      `SELECT c."citaID", c."clienteID", c.estado, s.precio
       FROM cita c
       JOIN servicios s ON c."servicioID" = s."serviciosID"
       WHERE c."citaID" = $1`,
      [citaId]
    );
    if (citaRes.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cita no encontrada' });
    }
    const cita = citaRes.rows[0];

    // El cliente solo paga sus propias citas.
    if (rol === 'cliente' && cita.clienteID !== solicitante) {
      return res.status(403).json({ ok: false, message: 'No puedes pagar una cita que no es tuya' });
    }
    if (cita.estado === 'cancelada') {
      return res.status(400).json({ ok: false, message: 'No se puede pagar una cita cancelada' });
    }

    if (metodo === 'pago_movil' && !req.file) {
      return res.status(400).json({ ok: false, message: 'Adjunta el comprobante del pago móvil' });
    }
    if (metodo === 'pago_movil' && !referencia) {
      return res.status(400).json({ ok: false, message: 'El número de referencia es obligatorio' });
    }

    // Un pago vigente por cita: se puede volver a intentar solo si el anterior fue rechazado.
    const vigente = await db.query(
      `SELECT "transaccionID" FROM transacciones
       WHERE "citaID" = $1 AND estado <> 'rechazado' LIMIT 1`,
      [citaId]
    );
    if (vigente.rows.length > 0) {
      return res.status(409).json({ ok: false, message: 'Esta cita ya tiene un pago registrado' });
    }

    const montoNum =
      monto === undefined || monto === null || monto === '' ? Number(cita.precio) : Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ ok: false, message: 'monto debe ser un número mayor que cero' });
    }

    const estado = metodo === 'pago_movil' ? 'pendiente' : 'completado';
    const comprobanteUrl = req.file ? `/uploads/${req.file.filename}` : null;
    // El pago queda a nombre del cliente de la cita; en citas de invitado, del operador.
    const usuarioPago = cita.clienteID ?? solicitante;

    const ins = await db.query(
      `INSERT INTO transacciones
         ("usuarioID", "citaID", monto, metodo_pago, estado, comprobante_url, referencia_pago, tipo_movimiento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pago')
       RETURNING "transaccionID"`,
      [usuarioPago, citaId, montoNum, metodo, estado, comprobanteUrl, referencia || null]
    );

    const pago = await buscarPago(ins.rows[0].transaccionID);

    res.status(201).json({
      ok: true,
      message:
        estado === 'pendiente'
          ? 'Comprobante recibido. Queda pendiente de aprobación.'
          : 'Pago registrado exitosamente',
      transaccion: pago
    });
  } catch (error) {
    console.error('Error al registrar el pago:', error.message);

    if (error.code === '23503') {
      return res.status(400).json({ ok: false, message: 'La cita o el usuario no existen' });
    }
    if (error.code === '23514') {
      return res.status(400).json({ ok: false, message: 'Valores de pago no permitidos' });
    }
    if (error.code === '22003') {
      return res.status(400).json({ ok: false, message: 'El monto está fuera de rango' });
    }
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// Cambia el estado de un pago pendiente. `destino` es 'completado' o 'rechazado'.
const resolverPago = async (req, res, destino) => {
  const transaccionId = Number(req.params.id);
  if (!Number.isInteger(transaccionId) || transaccionId <= 0) {
    return res.status(400).json({ ok: false, message: 'ID de pago no válido' });
  }

  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';

  try {
    const actual = await db.query(
      'SELECT estado FROM transacciones WHERE "transaccionID" = $1',
      [transaccionId]
    );
    if (actual.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Pago no encontrado' });
    }
    if (actual.rows[0].estado !== 'pendiente') {
      return res.status(409).json({
        ok: false,
        message: 'Solo se pueden resolver pagos pendientes'
      });
    }

    await db.query(
      `UPDATE transacciones
       SET estado = $1, motivo_rechazo = $2
       WHERE "transaccionID" = $3`,
      [destino, destino === 'rechazado' ? motivo || null : null, transaccionId]
    );

    const pago = await buscarPago(transaccionId);
    res.json({
      ok: true,
      message: destino === 'completado' ? 'Pago aprobado' : 'Pago rechazado',
      transaccion: pago
    });
  } catch (error) {
    console.error('Error al resolver el pago:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

const aprobarTransaccion = (req, res) => resolverPago(req, res, 'completado');

const rechazarTransaccion = (req, res) => resolverPago(req, res, 'rechazado');

module.exports = {
  obtenerTransacciones,
  obtenerTransaccionPorId,
  crearTransaccion,
  aprobarTransaccion,
  rechazarTransaccion
};
