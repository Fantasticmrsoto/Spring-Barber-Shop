const db = require('../config/db');
const { errorInterno } = require('../utils/respuestaError');
const { idValido } = require('../utils/validacion');

/**
 * Valida los datos de un servicio.
 *
 * La usan tanto el alta como la edición, para que las dos rutas acepten
 * exactamente lo mismo (y rechacen lo mismo).
 *
 * @param {object} datos
 * @param {boolean} [completo] Si es true, todos los campos son obligatorios.
 * @returns {{ error: string|null, valores: object }}
 */
const validarServicio = (datos, completo) => {
  const { nombre, descripcion, precio, duracion_minutos } = datos || {};

  const valores = {};
  const problemas = [];

  if (nombre !== undefined) {
    if (typeof nombre !== 'string' || !nombre.trim()) {
      problemas.push('El nombre no puede estar vacío');
    } else {
      valores.nombre = nombre.trim();
    }
  }

  if (descripcion !== undefined) {
    if (typeof descripcion !== 'string' || !descripcion.trim()) {
      problemas.push('La descripción no puede estar vacía');
    } else {
      valores.descripcion = descripcion.trim();
    }
  }

  if (precio !== undefined) {
    const precioNumerico = Number(precio);
    if (
      precio === null || precio === '' ||
      !Number.isFinite(precioNumerico) || precioNumerico < 0 ||
      // El máximo de numeric(10,2). Sin esta comprobación, un precio enorme
      // pasa la validación y PostgreSQL responde con "numeric field overflow",
      // que es un 500 en vez de un 400.
      precioNumerico > 99999999.99
    ) {
      problemas.push('El precio debe ser un número no negativo');
    } else {
      valores.precio = precioNumerico;
    }
  }

  if (duracion_minutos !== undefined) {
    const duracionMinutos = Number(duracion_minutos);
    if (!Number.isInteger(duracionMinutos) || duracionMinutos <= 0) {
      problemas.push('La duración debe ser un número entero de minutos mayor que 0');
    } else {
      valores.duracion_minutos = duracionMinutos;
    }
  }

  if (completo) {
    for (const campo of ['nombre', 'descripcion', 'precio', 'duracion_minutos']) {
      if (valores[campo] === undefined) {
        problemas.push(`Falta ${campo}`);
      }
    }
  }

  return {
    error: problemas.length ? problemas.join('. ') : null,
    valores,
  };
};

// 1. Obtener todos los servicios
const obtenerServicios = async (req, res) => {
  try {
    const resultado = await db.query(`
      SELECT "serviciosID", nombre, descripcion, precio, duracion_minutos
      FROM servicios
      ORDER BY "serviciosID" ASC
    `);
    res.json({
      ok: true,
      total: resultado.rows.length,
      servicios: resultado.rows
    });
  } catch (error) {
    errorInterno(res, error, 'Obtener Servicios');
  }
};

// 2. Obtener un servicio por ID
const obtenerServicioPorId = async (req, res) => {
  const { id } = req.params;
  const servicioId = Number(id);

  if (!Number.isInteger(servicioId) || servicioId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del servicio debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(
      'SELECT "serviciosID", nombre, descripcion, precio, duracion_minutos FROM servicios WHERE "serviciosID" = $1',
      [servicioId]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Servicio no encontrado' });
    }
    res.json({ ok: true, servicio: resultado.rows[0] });
  } catch (error) {
    errorInterno(res, error, 'Obtener Servicio Por Id');
  }
};

// 3. Crear un nuevo servicio
const crearServicio = async (req, res) => {
  // Sin la guarda `|| {}`, una petición sin cuerpo deja `req.body` como
  // undefined en Express 5 y el destructuring revienta con un TypeError
  // (500 en HTML) en vez de un 400 con mensaje.
  const { error, valores } = validarServicio(req.body || {}, true);

  if (error) {
    return res.status(400).json({
      ok: false,
      message: 'Nombre, descripción, precio no negativo y duración en minutos son obligatorios'
    });
  }

  try {
    const query = `
      INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos)
      VALUES ($1, $2, $3, $4)
      RETURNING "serviciosID", nombre, descripcion, precio, duracion_minutos;
    `;
    const resultado = await db.query(query, [
      valores.nombre,
      valores.descripcion,
      valores.precio,
      valores.duracion_minutos,
    ]);

    res.status(201).json({
      ok: true,
      message: 'Servicio creado exitosamente',
      servicio: resultado.rows[0]
    });
  } catch (error) {
    errorInterno(res, error, 'Crear Servicio');
  }
};

// 4. Editar un servicio
//
// El panel de administración necesita poder corregir un precio o un nombre:
// crear de nuevo el mismo servicio dejaría dos con el mismo nombre y la
// web mostraría los dos.
//
// La edición es parcial: solo se tocan los campos que llegan en el cuerpo.
const actualizarServicio = async (req, res) => {
  const servicioId = idValido(req.params.id);

  if (!servicioId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del servicio debe ser un número entero válido'
    });
  }

  const { error, valores } = validarServicio(req.body || {}, false);

  if (error) {
    return res.status(400).json({ ok: false, message: error });
  }

  const campos = Object.keys(valores);

  if (campos.length === 0) {
    return res.status(400).json({
      ok: false,
      message: 'No hay nada que actualizar'
    });
  }

  try {
    // El SET se arma con los campos que llegan, pero los valores van siempre
    // con marcadores de posición: nunca se concatena texto del cliente en la
    // consulta.
    const sets = campos.map((campo, indice) => `${campo} = $${indice + 1}`);
    const resultado = await db.query(
      `UPDATE servicios SET ${sets.join(', ')}
       WHERE "serviciosID" = $${campos.length + 1}
       RETURNING "serviciosID", nombre, descripcion, precio, duracion_minutos;`,
      [...campos.map((campo) => valores[campo]), servicioId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Servicio no encontrado' });
    }

    res.json({
      ok: true,
      message: 'Servicio actualizado exitosamente',
      servicio: resultado.rows[0]
    });
  } catch (error) {
    errorInterno(res, error, 'Actualizar Servicio');
  }
};

// 5. Eliminar un servicio
//
// Si el servicio ya tiene citas, no se borra: la FK `fk_cita_servicio` está
// en ON DELETE CASCADE y las citas desaparecerían con él, dejando huecos en la
// agenda y en los pagos. Las asignaciones a barberos sí se van solas (su FK
// también es CASCADE) porque no dejan rastro.
const eliminarServicio = async (req, res) => {
  const servicioId = idValido(req.params.id);

  if (!servicioId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del servicio debe ser un número entero válido'
    });
  }

  try {
    const citas = await db.query(
      'SELECT COUNT(*)::int AS total FROM cita WHERE "servicioID" = $1',
      [servicioId]
    );

    if (citas.rows[0].total > 0) {
      return res.status(400).json({
        ok: false,
        message: `No se puede eliminar: el servicio tiene ${citas.rows[0].total} cita(s) registrada(s)`
      });
    }

    const resultado = await db.query(
      'DELETE FROM servicios WHERE "serviciosID" = $1 RETURNING "serviciosID", nombre;',
      [servicioId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Servicio no encontrado' });
    }

    res.json({
      ok: true,
      message: 'Servicio eliminado exitosamente',
      servicio: resultado.rows[0]
    });
  } catch (error) {
    errorInterno(res, error, 'Eliminar Servicio');
  }
};

module.exports = {
  obtenerServicios,
  obtenerServicioPorId,
  crearServicio,
  actualizarServicio,
  eliminarServicio
};