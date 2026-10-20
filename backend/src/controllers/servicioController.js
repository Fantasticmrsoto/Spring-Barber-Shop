const db = require('../config/db');
const { errorInterno } = require('../utils/respuestaError');

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
  const { nombre, descripcion, precio, duracion_minutos } = req.body || {};
  const precioNumerico = Number(precio);
  const duracionMinutos = Number(duracion_minutos);

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof descripcion !== 'string' || !descripcion.trim() ||
    precio === null || precio === '' ||
    !Number.isFinite(precioNumerico) || precioNumerico < 0 ||
    // El máximo de numeric(10,2). Sin esta comprobación, un precio enorme
    // pasa la validación y PostgreSQL responde con "numeric field overflow",
    // que es un 500 en vez de un 400.
    precioNumerico > 99999999.99 ||
    !Number.isInteger(duracionMinutos) || duracionMinutos <= 0
  ) {
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
    const valores = [nombre.trim(), descripcion.trim(), precioNumerico, duracionMinutos];
    const resultado = await db.query(query, valores);

    res.status(201).json({
      ok: true,
      message: 'Servicio creado exitosamente',
      servicio: resultado.rows[0]
    });
  } catch (error) {
    errorInterno(res, error, 'Crear Servicio');
  }
};

module.exports = {
  obtenerServicios,
  obtenerServicioPorId,
  crearServicio
};