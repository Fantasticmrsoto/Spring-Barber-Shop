const db = require('../config/db');

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
    console.error('Error al obtener servicios:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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
    console.error('Error al obtener servicio:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 3. Crear un nuevo servicio
const crearServicio = async (req, res) => {
  const { nombre, descripcion, precio, duracion_minutos } = req.body;
  const precioNumerico = Number(precio);
  const duracionMinutos = Number(duracion_minutos);

  if (
    typeof nombre !== 'string' || !nombre.trim() ||
    typeof descripcion !== 'string' || !descripcion.trim() ||
    precio === null || precio === '' ||
    !Number.isFinite(precioNumerico) || precioNumerico < 0 ||
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
    console.error('Error al crear servicio:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 4. Actualizar un servicio por ID (parcial). Solo administrador.
const actualizarServicio = async (req, res) => {
  const { id } = req.params;
  const servicioId = Number(id);

  if (!Number.isInteger(servicioId) || servicioId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del servicio debe ser un número entero válido'
    });
  }

  const { nombre, descripcion, precio, duracion_minutos } = req.body || {};
  const campos = [];
  const valores = [];

  if (nombre !== undefined) {
    if (typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ ok: false, message: 'El nombre no puede estar vacío' });
    }
    valores.push(nombre.trim());
    campos.push(`nombre = $${valores.length}`);
  }
  if (descripcion !== undefined) {
    if (typeof descripcion !== 'string' || !descripcion.trim()) {
      return res.status(400).json({ ok: false, message: 'La descripción no puede estar vacía' });
    }
    valores.push(descripcion.trim());
    campos.push(`descripcion = $${valores.length}`);
  }
  if (precio !== undefined) {
    const precioNum = Number(precio);
    if (precio === null || precio === '' || !Number.isFinite(precioNum) || precioNum < 0) {
      return res.status(400).json({ ok: false, message: 'El precio debe ser un número no negativo' });
    }
    valores.push(precioNum);
    campos.push(`precio = $${valores.length}`);
  }
  if (duracion_minutos !== undefined) {
    const duracionNum = Number(duracion_minutos);
    if (!Number.isInteger(duracionNum) || duracionNum <= 0) {
      return res.status(400).json({ ok: false, message: 'La duración debe ser un entero mayor que 0' });
    }
    valores.push(duracionNum);
    campos.push(`duracion_minutos = $${valores.length}`);
  }

  if (campos.length === 0) {
    return res.status(400).json({ ok: false, message: 'No se envió ningún campo para actualizar' });
  }

  try {
    valores.push(servicioId);
    const resultado = await db.query(
      `UPDATE servicios SET ${campos.join(', ')}
       WHERE "serviciosID" = $${valores.length}
       RETURNING "serviciosID", nombre, descripcion, precio, duracion_minutos;`,
      valores
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
    console.error('Error al actualizar servicio:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 5. Eliminar un servicio por ID. Solo administrador.
//    Las citas referencian el servicio con ON DELETE CASCADE: borrarlo sin control
//    se llevaría por delante el historial, así que se bloquea si tiene citas.
const eliminarServicio = async (req, res) => {
  const { id } = req.params;
  const servicioId = Number(id);

  if (!Number.isInteger(servicioId) || servicioId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del servicio debe ser un número entero válido'
    });
  }

  try {
    const existe = await db.query(
      'SELECT "serviciosID" FROM servicios WHERE "serviciosID" = $1',
      [servicioId]
    );
    if (existe.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Servicio no encontrado' });
    }

    const citas = await db.query(
      'SELECT count(*)::int AS total FROM cita WHERE "servicioID" = $1',
      [servicioId]
    );
    if (citas.rows[0].total > 0) {
      return res.status(409).json({
        ok: false,
        message: `No se puede eliminar: ${citas.rows[0].total} cita(s) usan este servicio`
      });
    }

    // Sin citas, las asignaciones barbero_servicio se limpian por CASCADE.
    await db.query('DELETE FROM servicios WHERE "serviciosID" = $1', [servicioId]);

    res.json({
      ok: true,
      message: 'Servicio eliminado exitosamente',
      serviciosID: servicioId
    });
  } catch (error) {
    console.error('Error al eliminar servicio:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

module.exports = {
  obtenerServicios,
  obtenerServicioPorId,
  crearServicio,
  actualizarServicio,
  eliminarServicio
};