const bcrypt = require('bcryptjs');
const { errorInterno } = require('../utils/respuestaError');
const db = require('../config/db');

// 1. Obtener todos los usuarios
const obtenerUsuarios = async (req, res) => {
  try {
    const resultado = await db.query(
      'SELECT "usuarioID", nombre, apellido, correo, telefono, rol FROM usuario ORDER BY "usuarioID" DESC'
    );
    res.json({
      ok: true,
      total: resultado.rows.length,
      usuarios: resultado.rows
    });
  } catch (error) {
    errorInterno(res, error, 'Obtener Usuarios');
  }
};

// 2. Obtener un usuario por ID
const obtenerUsuarioPorId = async (req, res) => {
  const { id } = req.params;
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del usuario debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(
      'SELECT "usuarioID", nombre, apellido, correo, telefono, rol FROM usuario WHERE "usuarioID" = $1',
      [usuarioId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    res.json({ ok: true, usuario: resultado.rows[0] });
  } catch (error) {
    errorInterno(res, error, 'Obtener Usuario Por Id');
  }
};

// 3. Crear un nuevo usuario
const crearUsuario = async (req, res) => {
  const { nombre, apellido, correo, telefono, rol } = req.body || {};
  // `clave` es el nombre histórico de esta columna, pero /api/auth/login recibe la
  // misma cosa como `password`. Aceptar ambos evita que un cliente que use
  // `password` (como es lo natural en un login) reciba un 400 confuso.
  const clave = req.body?.clave || req.body?.password;

  if (!nombre || !apellido || !correo || !telefono || !clave) {
    return res.status(400).json({
      ok: false,
      message: 'Nombre, apellido, correo, teléfono y clave son obligatorios'
    });
  }

  // bcrypt solo acepta cadenas: con un número, `hash` lanza "Illegal
  // arguments" y la petición acaba en un 500 en vez de un 400.
  if (typeof clave !== 'string') {
    return res.status(400).json({
      ok: false,
      message: 'La clave debe ser un texto'
    });
  }

  try {
    // La clave se almacena como hash bcrypt, nunca en texto plano. El RETURNING no
    // incluye `clave`, así que la respuesta nunca la expone.
    const claveHasheada = await bcrypt.hash(clave, 10);
    const query = `
      INSERT INTO usuario (nombre, apellido, correo, telefono, rol, clave)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "usuarioID", nombre, apellido, correo, telefono, rol;
    `;
    const valores = [nombre, apellido, correo, telefono, rol || 'cliente', claveHasheada];

    const resultado = await db.query(query, valores);

    res.status(201).json({
      ok: true,
      message: 'Usuario creado exitosamente',
      usuario: resultado.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ ok: false, message: 'El correo electrónico ya está registrado' });
    }
    errorInterno(res, error, 'Crear Usuario');
  }
};



// 4. Actualizar un usuario por ID
const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const usuarioId = Number(id);
  const { nombre, apellido, correo, telefono, rol } = req.body || {};
  // Mismo alias que en crearUsuario: `clave` o `password` funcionan igual
  const clave = req.body?.clave || req.body?.password;

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del usuario debe ser un número entero válido'
    });
  }

  // bcrypt solo acepta cadenas (ver crearUsuario).
  if (clave !== undefined && clave !== null && typeof clave !== 'string') {
    return res.status(400).json({
      ok: false,
      message: 'La clave debe ser un texto'
    });
  }

  try {
    // Solo se hashea si viene una clave nueva. Si el body no trae `clave`, se pasa
    // null y el COALESCE conserva el hash que ya tenía.
    const claveHasheada = clave ? await bcrypt.hash(clave, 10) : null;
    const query = `
      UPDATE usuario
      SET nombre = COALESCE($1, nombre),
          apellido = COALESCE($2, apellido),
          correo = COALESCE($3, correo),
          telefono = COALESCE($4, telefono),
          rol = COALESCE($5, rol),
          clave = COALESCE($6, clave)
      WHERE "usuarioID" = $7
      RETURNING "usuarioID", nombre, apellido, correo, telefono, rol;
    `;
    const valores = [nombre, apellido, correo, telefono, rol, claveHasheada, usuarioId];
    const resultado = await db.query(query, valores);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    res.json({
      ok: true,
      message: 'Usuario actualizado exitosamente',
      usuario: resultado.rows[0]
    });
  } catch (error) {
    errorInterno(res, error, 'Actualizar Usuario');
  }
};

// 5. Eliminar un usuario por ID
const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  const usuarioId = Number(id);

  if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del usuario debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(
      'DELETE FROM usuario WHERE "usuarioID" = $1 RETURNING "usuarioID"',
      [usuarioId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    res.json({
      ok: true,
      message: 'Usuario eliminado exitosamente',
      usuarioID: resultado.rows[0].usuarioID
    });
  } catch (error) {
    errorInterno(res, error, 'Eliminar Usuario');
  }
};


module.exports = {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario
};