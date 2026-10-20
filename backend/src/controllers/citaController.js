const db = require('../config/db');
const { errorInterno } = require('../utils/respuestaError');
const { nombreDia, horaAMinutos, fechaYmd, parsearFechaHora } = require('../utils/validacion');
const { esDiaDeDescanso, mensajeDiaDeDescanso } = require('../config/calendario');

// Estados permitidos (deben coincidir con el CHECK de la migración 001)
const ESTADOS_VALIDOS = ['pendiente', 'confirmada', 'completada', 'cancelada'];

// Error de negocio con código HTTP, para diferenciarlo de un fallo de PostgreSQL
const errorHttp = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

// 1. Obtener todas las citas
const obtenerCitas = async (req, res) => {
  try {
    const query = `
      SELECT
        c."citaID",
        c."clienteID",
        c."barberoID",
        c."servicioID",
        c.fecha_inicio,
        c.fecha_fin,
        c.estado,
        u.nombre   AS cliente_nombre,
        u.apellido AS cliente_apellido,
        ub.nombre  AS barbero_nombre,
        ub.apellido AS barbero_apellido,
        s.nombre   AS servicio_nombre,
        s.precio,
        s.duracion_minutos
      FROM cita c
      JOIN usuario u   ON c."clienteID"  = u."usuarioID"
      JOIN barbero b   ON c."barberoID"  = b."barberoID"
      JOIN usuario ub  ON b."usuarioID"  = ub."usuarioID"
      JOIN servicios s ON c."servicioID" = s."serviciosID"
      ORDER BY c.fecha_inicio DESC;
    `;
    const resultado = await db.query(query);
    res.json({
      ok: true,
      total: resultado.rows.length,
      citas: resultado.rows
    });
  } catch (error) {
    errorInterno(res, error, 'Obtener Citas');
  }
};

// 2. Crear una nueva cita con validación de solapamiento de horarios
const crearCita = async (req, res) => {
  const { clienteID, barberoID, servicioID, fecha_hora } = req.body || {};

  const clienteId = Number(clienteID);
  const barberoId = Number(barberoID);
  const servicioId = Number(servicioID);
  const fechaInicio = fecha_hora ? parsearFechaHora(fecha_hora) : null;

  if (
    !Number.isInteger(clienteId) || clienteId <= 0 ||
    !Number.isInteger(barberoId) || barberoId <= 0 ||
    !Number.isInteger(servicioId) || servicioId <= 0 ||
    !fechaInicio || Number.isNaN(fechaInicio.getTime())
  ) {
    return res.status(400).json({
      ok: false,
      message: 'clienteID, barberoID, servicioID y una fecha_hora válida son obligatorios'
    });
  }

  try {
    const cita = await db.withTransaction(async (client) => {
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

      // D. Días en los que la peluquería no abre.
      //
      // El día de descanso se deduce del día de la semana; los feriados
      // vienen de la tabla `feriado`.
      //
      // Va antes que la comprobación del horario laboral a propósito: si el
      // barbero no tiene horario un domingo, el mensaje que sale debe decir
      // que es día de descanso, no que a ese barbero le falta el horario.
      //
      // Se comprueba aquí y no solo en la web: es el servidor el que dice que
      // no, porque el navegador se puede saltarse. Va dentro de la
      // transacción para que la comprobación y el INSERT sean atómicos.
      if (esDiaDeDescanso(fechaInicio)) {
        throw errorHttp(400, mensajeDiaDeDescanso(fechaInicio));
      }

      const feriadoRes = await client.query(
        'SELECT nombre FROM feriado WHERE fecha = $1',
        [fechaYmd(fechaInicio)]
      );
      if (feriadoRes.rows.length > 0) {
        throw errorHttp(400, `No se puede reservar: ${feriadoRes.rows[0].nombre}.`);
      }

      // E. La cita debe caer dentro del horario laboral configurado para ese día.
      //    Va dentro de la transacción y usa `client` para que la validación y el
      //    INSERT sean atómicos.
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

      // F. Solapamiento: el intervalo [fecha_inicio, fecha_fin) de la nueva cita
      //    contra las citas existentes del mismo barbero. Las canceladas no bloquean.
      const cruce = await client.query(
        `SELECT "citaID", fecha_inicio, fecha_fin
         FROM cita
         WHERE "barberoID" = $1
           AND estado <> 'cancelada'
           AND fecha_inicio < $3
           AND fecha_fin   > $2`,
        [barberoId, fechaInicio, fechaFin]
      );
      if (cruce.rows.length > 0) {
        throw errorHttp(400, 'El barbero ya tiene una cita que se cruza con ese horario');
      }

      // G. Insertar la nueva cita
      const insercion = await client.query(
        `INSERT INTO cita ("clienteID", "barberoID", "servicioID", fecha_inicio, fecha_fin, estado)
         VALUES ($1, $2, $3, $4, $5, 'pendiente')
         RETURNING "citaID", "clienteID", "barberoID", "servicioID", fecha_inicio, fecha_fin, estado;`,
        [clienteId, barberoId, servicioId, fechaInicio, fechaFin]
      );
      return insercion.rows[0];
    });

    res.status(201).json({
      ok: true,
      message: 'Cita agendada exitosamente',
      cita
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ ok: false, message: error.message });
    }
    if (error.code === '23503') {
      return res.status(400).json({ ok: false, message: 'El cliente indicado no existe' });
    }
    if (error.code === '23514') {
      return res.status(400).json({ ok: false, message: 'Estado de cita no válido' });
    }
    errorInterno(res, error, 'Crear Cita');
  }
};

// 3. Actualizar estado de la cita (ej. completada, cancelada)
const actualizarEstadoCita = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};

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
    const resultado = await db.query(
      'UPDATE cita SET estado = $1 WHERE "citaID" = $2 RETURNING "citaID", "clienteID", "barberoID", "servicioID", fecha_inicio, fecha_fin, estado;',
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
    errorInterno(res, error, 'Actualizar Estado Cita');
  }
};

module.exports = {
  obtenerCitas,
  crearCita,
  actualizarEstadoCita
};