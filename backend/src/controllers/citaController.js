const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../config/jwt');

// Estados permitidos (deben coincidir con el CHECK de la migración 001)
const ESTADOS_VALIDOS = ['pendiente', 'confirmada', 'completada', 'cancelada'];

// Estados desde los que todavía se puede cancelar.
const ESTADOS_CANCELABLES = ['pendiente', 'confirmada'];

// Días de la semana en el mismo formato que exige el CHECK horario_laboral_dia_check.
// El índice corresponde a Date.getDay(): 0 = domingo.
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const nombreDia = (fecha) => DIAS_SEMANA[fecha.getDay()];

// Convierte una hora "HH:MM" o "HH:MM:SS" a minutos desde medianoche.
const horaAMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

// Error de negocio con código HTTP, para diferenciarlo de un fallo de PostgreSQL
const errorHttp = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// ---------------------------------------------------------------------------
// Fechas "naive" (hora local del negocio)
//
// `cita.fecha_inicio` es `timestamp without time zone`: la columna guarda una hora
// de pared, no un instante. Para que la hora reservada sea la misma sin importar la
// zona horaria del servidor o del navegador, se trabaja de extremo a extremo con
// componentes locales y se envían/leen como texto "YYYY-MM-DD HH:MM:SS". Así el
// 10:00 que pide el cliente queda guardado y devuelto como 10:00 (antes se corría a
// 14:00 al pasar por Date/UTC).
// ---------------------------------------------------------------------------

// Acepta "YYYY-MM-DDTHH:MM", "YYYY-MM-DD HH:MM" o con segundos, sin zona horaria.
const RE_FECHA_LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

const parsearFechaLocal = (valor) => {
  if (typeof valor !== 'string') return null;
  const m = RE_FECHA_LOCAL.exec(valor.trim());
  if (!m) return null;
  const [, anio, mes, dia, hora, minuto, segundo = '0'] = m;
  const fecha = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    Number(hora),
    Number(minuto),
    Number(segundo)
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const dosDigitos = (n) => String(n).padStart(2, '0');

// Formatea un Date como el literal que espera una columna timestamp without time zone.
const aTimestampSql = (fecha) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())} ` +
  `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}:${dosDigitos(fecha.getSeconds())}`;

// Devuelve las fechas como texto naive (sin Z) para que el navegador las interprete
// como hora local y no las desplace.
const CAMPOS_FECHA_CITA = `
    to_char(c.fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inicio,
    to_char(c.fecha_fin,    'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_fin`;

const soloDigitos = (valor) => String(valor || '').replace(/\D/g, '');

// ---------------------------------------------------------------------------
// Núcleo del agendamiento: valida el horario y el solapamiento del barbero y
// devuelve los timestamps naive de inicio/fin. `excluirCitaId` deja fuera una cita
// concreta del chequeo de solape, para reprogramarla sin que choque consigo misma.
// ---------------------------------------------------------------------------
const validarHorarioYSolape = async ({ client, barberoId, servicioId, fechaInicio, excluirCitaId = null }) => {
  // A. Bloquear la fila del barbero para que dos reservas simultáneas
  //    del mismo barbero no puedan saltarse la validación de solapamiento.
  const barberoRes = await client.query(
    'SELECT "barberoID", estado FROM barbero WHERE "barberoID" = $1 FOR UPDATE',
    [barberoId]
  );
  if (barberoRes.rows.length === 0) {
    throw errorHttp(404, 'Barbero no encontrado');
  }
  if (!barberoRes.rows[0].estado) {
    throw errorHttp(400, 'El barbero no está activo');
  }

  // B. La duración del servicio define la hora de fin de la cita
  const servicioRes = await client.query(
    'SELECT "serviciosID", duracion_minutos FROM servicios WHERE "serviciosID" = $1',
    [servicioId]
  );
  if (servicioRes.rows.length === 0) {
    throw errorHttp(404, 'Servicio no encontrado');
  }
  const { duracion_minutos: duracionMinutos } = servicioRes.rows[0];
  const fechaFin = new Date(fechaInicio.getTime() + duracionMinutos * 60 * 1000);

  // C. La cita debe caer dentro del horario laboral configurado para ese día.
  const dia = nombreDia(fechaInicio);
  const horarioRes = await client.query(
    `SELECT hora_inicio, hora_fin
     FROM horario_laboral
     WHERE "barberoID" = $1 AND dia_semana = $2`,
    [barberoId, dia]
  );
  if (horarioRes.rows.length === 0) {
    throw errorHttp(400, `El barbero no tiene horario configurado para el ${dia}`);
  }

  const { hora_inicio: horaInicio, hora_fin: horaFin } = horarioRes.rows[0];

  // Un servicio que termina de madrugada no se puede validar contra una franja
  // horaria del mismo día, así que se rechaza explícitamente.
  if (fechaFin.toDateString() !== fechaInicio.toDateString()) {
    throw errorHttp(400, 'La cita no puede cruzar la medianoche');
  }

  const citaInicioMin = fechaInicio.getHours() * 60 + fechaInicio.getMinutes();
  const citaFinMin = fechaFin.getHours() * 60 + fechaFin.getMinutes();

  if (citaInicioMin < horaAMinutos(horaInicio) || citaFinMin > horaAMinutos(horaFin)) {
    throw errorHttp(400, `La cita está fuera del horario laboral del barbero (${horaInicio} - ${horaFin})`);
  }

  const inicioSql = aTimestampSql(fechaInicio);
  const finSql = aTimestampSql(fechaFin);

  // D. Solapamiento: el intervalo [fecha_inicio, fecha_fin) contra las citas
  //    existentes del mismo barbero. Las canceladas no bloquean.
  const cruce = await client.query(
    `SELECT "citaID"
     FROM cita
     WHERE "barberoID" = $1
       AND estado <> 'cancelada'
       AND fecha_inicio < $3::timestamp
       AND fecha_fin   > $2::timestamp
       AND ($4::int IS NULL OR "citaID" <> $4::int)`,
    [barberoId, inicioSql, finSql, excluirCitaId]
  );
  if (cruce.rows.length > 0) {
    throw errorHttp(400, 'El barbero ya tiene una cita que se cruza con ese horario');
  }

  return { inicioSql, finSql };
};

// ---------------------------------------------------------------------------
// Inserta la cita (fechas como texto naive, sin conversión de zona). Reutilizado
// por la reserva con sesión y por la reserva pública. `clienteId` puede ser null
// (reserva de invitado); en ese caso el contacto va en `contacto`.
// ---------------------------------------------------------------------------
const agendarCita = async ({ clienteId, barberoId, servicioId, fechaInicio, contacto, client: clientExterno }) => {
  const ejecutar = async (client) => {
    const { inicioSql, finSql } = await validarHorarioYSolape({ client, barberoId, servicioId, fechaInicio });

    const insercion = await client.query(
      `INSERT INTO cita
         ("clienteID", "barberoID", "servicioID", fecha_inicio, fecha_fin, estado,
          contacto_nombre, contacto_telefono)
       VALUES ($1, $2, $3, $4::timestamp, $5::timestamp, 'pendiente', $6, $7)
       RETURNING
         "citaID", "clienteID", "barberoID", "servicioID", "estado",
         contacto_nombre, contacto_telefono,
         to_char(fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inicio,
         to_char(fecha_fin,    'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_fin;`,
      [
        clienteId,
        barberoId,
        servicioId,
        inicioSql,
        finSql,
        contacto?.nombre || null,
        contacto?.telefono || null
      ]
    );
    return insercion.rows[0];
  };

  return clientExterno ? ejecutar(clientExterno) : db.withTransaction(ejecutar);
};

// 1. Obtener citas. El alcance depende del rol del token:
//    administrador ve todas, barbero solo las suyas, cliente solo las propias.
const obtenerCitas = async (req, res) => {
  const { usuarioID, rol } = req.usuario;

  let filtro = '';
  if (rol === 'barbero') {
    filtro = 'WHERE b."usuarioID" = $1';
  } else if (rol === 'cliente') {
    filtro = 'WHERE c."clienteID" = $1';
  }

  const params = filtro ? [usuarioID] : [];

  try {
    const query = `
      SELECT
        c."citaID",
        c."clienteID",
        c."barberoID",
        c."servicioID",
${CAMPOS_FECHA_CITA},
        c.estado,
        c.contacto_nombre,
        c.contacto_telefono,
        (c."clienteID" IS NULL) AS es_invitado,
        COALESCE(u.nombre, c.contacto_nombre, 'Invitado') AS cliente_nombre,
        COALESCE(u.apellido, '') AS cliente_apellido,
        COALESCE(u.telefono, c.contacto_telefono) AS cliente_telefono,
        ub.nombre  AS barbero_nombre,
        ub.apellido AS barbero_apellido,
        s.nombre   AS servicio_nombre,
        s.precio,
        s.duracion_minutos,
        (SELECT t.estado FROM transacciones t
          WHERE t."citaID" = c."citaID"
          ORDER BY t."transaccionID" DESC LIMIT 1) AS pago_estado,
        (SELECT t.metodo_pago FROM transacciones t
          WHERE t."citaID" = c."citaID"
          ORDER BY t."transaccionID" DESC LIMIT 1) AS pago_metodo
      FROM cita c
      LEFT JOIN usuario u  ON c."clienteID"  = u."usuarioID"
      JOIN barbero b   ON c."barberoID"  = b."barberoID"
      JOIN usuario ub  ON b."usuarioID"  = ub."usuarioID"
      JOIN servicios s ON c."servicioID" = s."serviciosID"
      ${filtro}
      ORDER BY c.fecha_inicio DESC;
    `;
    const resultado = await db.query(query, params);
    res.json({
      ok: true,
      total: resultado.rows.length,
      citas: resultado.rows
    });
  } catch (error) {
    console.error('Error al obtener citas:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 2. Ocupados de un barbero (solo horas, sin datos del cliente). Público, para que
//    el wizard de reserva calcule cupos libres incluso sin sesión.
const obtenerOcupados = async (req, res) => {
  const barberoId = Number(req.query.barberoID);

  if (!Number.isInteger(barberoId) || barberoId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El query param barberoID debe ser un número entero válido'
    });
  }

  // Rango opcional (naive) para acotar el día que se está consultando.
  const params = [barberoId];
  let rango = '';

  const desde = parsearFechaLocal(req.query.desde);
  const hasta = parsearFechaLocal(req.query.hasta);
  if (desde) {
    params.push(aTimestampSql(desde));
    rango += ` AND c.fecha_inicio >= $${params.length}::timestamp`;
  }
  if (hasta) {
    params.push(aTimestampSql(hasta));
    rango += ` AND c.fecha_inicio <= $${params.length}::timestamp`;
  }

  // Al reprogramar se excluye la propia cita para que su antigua hora no aparezca
  // como ocupada. No es una regla de seguridad: el servidor revalida el solape.
  const excluir = Number(req.query.excluir);
  if (Number.isInteger(excluir) && excluir > 0) {
    params.push(excluir);
    rango += ` AND c."citaID" <> $${params.length}::int`;
  }

  try {
    const resultado = await db.query(
      `
        SELECT
          to_char(c.fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inicio,
          to_char(c.fecha_fin,    'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_fin
        FROM cita c
        WHERE c."barberoID" = $1
          AND c.estado <> 'cancelada'
          ${rango}
        ORDER BY c.fecha_inicio ASC;
      `,
      params
    );

    res.json({ ok: true, ocupados: resultado.rows });
  } catch (error) {
    console.error('Error al obtener ocupados:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 3. Crear una cita con sesión iniciada.
//    - Cliente: agenda para sí mismo.
//    - Staff (admin/barbero): puede agendar para cualquier cliente registrado o,
//      sin `clienteID`, una cita de "walk-in" con nombre y teléfono de contacto.
const crearCita = async (req, res) => {
  const { clienteID, barberoID, servicioID, fecha_hora } = req.body || {};

  const barberoId = Number(barberoID);
  const servicioId = Number(servicioID);
  const fechaInicio = parsearFechaLocal(fecha_hora);

  if (
    !Number.isInteger(barberoId) || barberoId <= 0 ||
    !Number.isInteger(servicioId) || servicioId <= 0 ||
    !fechaInicio
  ) {
    return res.status(400).json({
      ok: false,
      message: 'barberoID, servicioID y una fecha_hora válida (YYYY-MM-DDTHH:MM) son obligatorios'
    });
  }

  const esStaff = req.usuario.rol === 'administrador' || req.usuario.rol === 'barbero';

  // Cliente destino: puede venir en el cuerpo (cuenta existente) o quedarse vacío.
  let clienteId = null;
  let contacto = null;

  const traeCliente = clienteID !== undefined && clienteID !== null && clienteID !== '';

  if (traeCliente) {
    clienteId = Number(clienteID);
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      return res.status(400).json({ ok: false, message: 'clienteID debe ser un número entero válido' });
    }
    // Un cliente solo puede agendar para sí mismo.
    if (!esStaff && clienteId !== req.usuario.usuarioID) {
      return res.status(403).json({ ok: false, message: 'Solo puedes agendar citas para tu propia cuenta' });
    }
  } else if (!esStaff) {
    // El cliente siempre reserva para sí mismo aunque no mande clienteID.
    clienteId = req.usuario.usuarioID;
  } else {
    // Staff sin cliente registrado: cita de walk-in con datos de contacto.
    const nombreLimpio = String(req.body?.contacto_nombre || req.body?.nombre || '').trim();
    const telefonoLimpio = String(req.body?.contacto_telefono || req.body?.telefono || '').trim();
    if (!nombreLimpio || soloDigitos(telefonoLimpio).length < 7) {
      return res.status(400).json({
        ok: false,
        message: 'Indica un cliente registrado (clienteID) o el nombre y un teléfono de contacto de al menos 7 dígitos'
      });
    }
    contacto = { nombre: nombreLimpio, telefono: telefonoLimpio };
  }

  try {
    const cita = await agendarCita({ clienteId, barberoId, servicioId, fechaInicio, contacto });
    res.status(201).json({ ok: true, message: 'Cita agendada exitosamente', cita });
  } catch (error) {
    console.error('Error al crear cita:', error.message);
    responderErrorCita(error, res);
  }
};

// 4. Reserva pública (sin sesión). NO crea ninguna cuenta de usuario: el nombre y
//    el teléfono del invitado se guardan en la propia cita. Devuelve un `codigo`
//    (JWT de gestión) para ver/cancelar la cita sin cuenta.
const crearCitaPublica = async (req, res) => {
  const { nombre, apellido, telefono, barberoID, servicioID, fecha_hora } = req.body || {};

  const barberoId = Number(barberoID);
  const servicioId = Number(servicioID);
  const fechaInicio = parsearFechaLocal(fecha_hora);
  const nombreLimpio = String(nombre || '').trim();
  const apellidoLimpio = String(apellido || '').trim();
  const telefonoLimpio = String(telefono || '').trim();
  const digitosTelefono = soloDigitos(telefonoLimpio);

  if (
    !nombreLimpio || !apellidoLimpio || digitosTelefono.length < 7 ||
    !Number.isInteger(barberoId) || barberoId <= 0 ||
    !Number.isInteger(servicioId) || servicioId <= 0 ||
    !fechaInicio
  ) {
    return res.status(400).json({
      ok: false,
      message: 'Nombre, apellido, teléfono (mínimo 7 dígitos), barbero, servicio y fecha_hora son obligatorios'
    });
  }

  try {
    const cita = await agendarCita({
      clienteId: null,
      barberoId,
      servicioId,
      fechaInicio,
      contacto: {
        nombre: `${nombreLimpio} ${apellidoLimpio}`.trim(),
        telefono: telefonoLimpio
      }
    });

    const codigo = jwt.sign(
      { citaID: cita.citaID, tipo: 'gestion' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      ok: true,
      message: 'Cita agendada exitosamente',
      cita,
      codigo
    });
  } catch (error) {
    console.error('Error al crear cita pública:', error.message);
    responderErrorCita(error, res);
  }
};

const verificarCodigoGestion = (codigo) => {
  try {
    const payload = jwt.verify(codigo, JWT_SECRET);
    return payload.tipo === 'gestion' ? payload : null;
  } catch {
    return null;
  }
};

const SELECT_CITA_PUBLICA = `
  SELECT
    c."citaID",
    c.estado,
${CAMPOS_FECHA_CITA},
    ub.nombre   AS barbero_nombre,
    ub.apellido AS barbero_apellido,
    s.nombre    AS servicio_nombre,
    s.precio,
    s.duracion_minutos,
    COALESCE(u.nombre, c.contacto_nombre, 'Invitado') AS cliente_nombre,
    COALESCE(u.apellido, '') AS cliente_apellido,
    COALESCE(u.telefono, c.contacto_telefono) AS cliente_telefono,
    (c."clienteID" IS NULL) AS es_invitado
  FROM cita c
  JOIN barbero b   ON c."barberoID"  = b."barberoID"
  JOIN usuario ub  ON b."usuarioID"  = ub."usuarioID"
  JOIN servicios s ON c."servicioID" = s."serviciosID"
  LEFT JOIN usuario u ON c."clienteID" = u."usuarioID"
`;

// 5. Ver una cita a partir del código de gestión (público, sin sesión).
const obtenerCitaPublica = async (req, res) => {
  const payload = verificarCodigoGestion(req.params.codigo);
  if (!payload) {
    return res.status(401).json({ ok: false, message: 'El enlace de la cita no es válido o expiró' });
  }

  try {
    const resultado = await db.query(`${SELECT_CITA_PUBLICA} WHERE c."citaID" = $1`, [payload.citaID]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cita no encontrada' });
    }
    res.json({ ok: true, cita: resultado.rows[0] });
  } catch (error) {
    console.error('Error al obtener cita pública:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 6. Cancelar la cita desde el código de gestión (público). Solo permite cancelar.
const cancelarCitaPublica = async (req, res) => {
  const payload = verificarCodigoGestion(req.params.codigo);
  if (!payload) {
    return res.status(401).json({ ok: false, message: 'El enlace de la cita no es válido o expiró' });
  }

  try {
    const actualizada = await db.query(
      `UPDATE cita SET estado = 'cancelada'
       WHERE "citaID" = $1 AND estado = ANY($2)
       RETURNING
         "citaID", estado,
         to_char(fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inicio,
         to_char(fecha_fin,    'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_fin;`,
      [payload.citaID, ESTADOS_CANCELABLES]
    );

    if (actualizada.rows.length > 0) {
      const cita = await db.query(`${SELECT_CITA_PUBLICA} WHERE c."citaID" = $1`, [payload.citaID]);
      return res.json({ ok: true, message: 'Cita cancelada', cita: cita.rows[0] });
    }

    // No se pudo cancelar: puede que ya no exista o que ya esté cancelada/completada.
    const existe = await db.query('SELECT estado FROM cita WHERE "citaID" = $1', [payload.citaID]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cita no encontrada' });
    }
    if (existe.rows[0].estado === 'cancelada') {
      const cita = await db.query(`${SELECT_CITA_PUBLICA} WHERE c."citaID" = $1`, [payload.citaID]);
      return res.json({ ok: true, message: 'La cita ya estaba cancelada', cita: cita.rows[0] });
    }
    return res.status(400).json({ ok: false, message: 'La cita ya no se puede cancelar' });
  } catch (error) {
    console.error('Error al cancelar cita pública:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 7. Actualizar estado de la cita con sesión.
//    - administrador/barbero: cualquier transición del flujo.
//    - cliente: solo puede cancelar su propia cita.
const actualizarEstadoCita = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};
  const { usuarioID, rol } = req.usuario;

  const citaId = Number(id);
  if (!Number.isInteger(citaId) || citaId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID de la cita debe ser un número entero válido'
    });
  }
  if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      ok: false,
      message: `Estado no válido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`
    });
  }

  try {
    // El cliente solo puede cancelar, y solo su propia cita.
    if (rol === 'cliente') {
      if (estado !== 'cancelada') {
        return res.status(403).json({ ok: false, message: 'Solo puedes cancelar tus citas' });
      }
      const propia = await db.query(
        'SELECT "clienteID" FROM cita WHERE "citaID" = $1',
        [citaId]
      );
      if (propia.rows.length === 0) {
        return res.status(404).json({ ok: false, message: 'Cita no encontrada' });
      }
      if (propia.rows[0].clienteID !== usuarioID) {
        return res.status(403).json({ ok: false, message: 'Esa cita no es tuya' });
      }
    }

    const resultado = await db.query(
      `UPDATE cita SET estado = $1
       WHERE "citaID" = $2
       RETURNING
         "citaID", "clienteID", "barberoID", "servicioID", "estado",
         to_char(fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inicio,
         to_char(fecha_fin,    'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_fin;`,
      [estado, citaId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Cita no encontrada' });
    }

    res.json({
      ok: true,
      message: 'Estado de cita actualizado',
      cita: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar cita:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 8. Reprogramar una cita: cambia solo la fecha y hora (mantiene barbero y
//    servicio). El cliente solo puede reprogramar las suyas y si siguen
//    pendientes o confirmadas; el administrador, cualquiera en ese mismo rango.
const reprogramarCita = async (req, res) => {
  const { usuarioID, rol } = req.usuario;
  const citaId = Number(req.params.id);
  const { fecha_hora } = req.body || {};
  const fechaInicio = parsearFechaLocal(fecha_hora);

  if (!Number.isInteger(citaId) || citaId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID de la cita debe ser un número entero válido'
    });
  }
  if (!fechaInicio) {
    return res.status(400).json({
      ok: false,
      message: 'Una fecha_hora válida (YYYY-MM-DDTHH:MM) es obligatoria'
    });
  }

  try {
    const cita = await db.withTransaction(async (client) => {
      const actualRes = await client.query(
        `SELECT "citaID", "clienteID", "barberoID", "servicioID", estado
         FROM cita WHERE "citaID" = $1 FOR UPDATE`,
        [citaId]
      );
      if (actualRes.rows.length === 0) {
        throw errorHttp(404, 'Cita no encontrada');
      }
      const actual = actualRes.rows[0];

      if (rol === 'cliente' && actual.clienteID !== usuarioID) {
        throw errorHttp(403, 'Esa cita no es tuya');
      }
      if (!ESTADOS_CANCELABLES.includes(actual.estado)) {
        throw errorHttp(400, 'Solo se pueden reprogramar citas pendientes o confirmadas');
      }

      const { inicioSql, finSql } = await validarHorarioYSolape({
        client,
        barberoId: actual.barberoID,
        servicioId: actual.servicioID,
        fechaInicio,
        excluirCitaId: citaId
      });

      const actualizada = await client.query(
        `UPDATE cita
         SET fecha_inicio = $1::timestamp, fecha_fin = $2::timestamp
         WHERE "citaID" = $3
         RETURNING
           "citaID", "clienteID", "barberoID", "servicioID", "estado",
           to_char(fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_inicio,
           to_char(fecha_fin,    'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_fin;`,
        [inicioSql, finSql, citaId]
      );
      return actualizada.rows[0];
    });

    res.json({ ok: true, message: 'Cita reprogramada exitosamente', cita });
  } catch (error) {
    console.error('Error al reprogramar cita:', error.message);
    responderErrorCita(error, res);
  }
};

// Traduce los errores del agendamiento a respuestas HTTP coherentes.
function responderErrorCita(error, res) {
  if (error.status) {
    return res.status(error.status).json({ ok: false, message: error.message });
  }
  if (error.code === '23503') {
    return res.status(400).json({ ok: false, message: 'El cliente indicado no existe' });
  }
  if (error.code === '23514') {
    return res.status(400).json({ ok: false, message: 'Estado de cita no válido' });
  }
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
}

module.exports = {
  obtenerCitas,
  obtenerOcupados,
  crearCita,
  crearCitaPublica,
  obtenerCitaPublica,
  cancelarCitaPublica,
  actualizarEstadoCita,
  reprogramarCita
};
