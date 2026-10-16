const bcrypt = require('bcryptjs');
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
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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

    // Si es un cliente que se registra, se vinculan las citas de invitado hechas
    // antes con ese mismo teléfono (reservas sin cuenta), para que las vea en
    // "Mis citas". Se compara solo por dígitos.
    const rolFinal = resultado.rows[0].rol;
    let citasVinculadas = 0;
    if (rolFinal === 'cliente') {
      try {
        const vinculadas = await db.query(
          `UPDATE cita SET "clienteID" = $1
           WHERE "clienteID" IS NULL
             AND regexp_replace(COALESCE(contacto_telefono, ''), '\\D', '', 'g')
                 = regexp_replace($2, '\\D', '', 'g')`,
          [resultado.rows[0].usuarioID, telefono]
        );
        citasVinculadas = vinculadas.rowCount;
      } catch (errorVinculo) {
        // No es fatal: el usuario ya quedó creado. Solo se registra el fallo.
        console.error('No se pudieron vincular citas de invitado:', errorVinculo.message);
      }
    }

    res.status(201).json({
      ok: true,
      message: 'Usuario creado exitosamente',
      usuario: resultado.rows[0],
      citasVinculadas
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.code === '23505') {
      return res.status(400).json({ ok: false, message: 'El correo electrónico ya está registrado' });
    }
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};


// 6. Actualizar el propio perfil (autoservicio). A diferencia de `actualizarUsuario`
//    (endpoint de staff), aquí el usuario solo toca SU fila: el `usuarioID` sale del
//    token, nunca del cuerpo, así que no puede editar a nadie más ni cambiarse el rol.
//    El cambio de contraseña exige además la contraseña actual.
const actualizarMiPerfil = async (req, res) => {
  const usuarioId = req.usuario.usuarioID;
  const { nombre, apellido, correo, telefono } = req.body || {};
  // `clave`/`password` se aceptan como alias de `claveNueva` por comodidad del cliente.
  const claveNueva = req.body?.claveNueva || req.body?.clave || req.body?.password;
  const claveActual = req.body?.claveActual;

  try {
    if (correo !== undefined && String(correo).trim() === '') {
      return res.status(400).json({ ok: false, message: 'El correo no puede quedar vacío' });
    }
    if (telefono !== undefined && String(telefono).trim() === '') {
      return res.status(400).json({ ok: false, message: 'El teléfono no puede quedar vacío' });
    }
    if (nombre !== undefined && String(nombre).trim() === '') {
      return res.status(400).json({ ok: false, message: 'El nombre no puede quedar vacío' });
    }
    if (apellido !== undefined && String(apellido).trim() === '') {
      return res.status(400).json({ ok: false, message: 'El apellido no puede quedar vacío' });
    }

    const actualRes = await db.query('SELECT clave FROM usuario WHERE "usuarioID" = $1', [usuarioId]);
    if (actualRes.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    // Solo se hashea si se pidió cambiar la contraseña; si no, el COALESCE conserva
    // la que ya tenía.
    let claveHasheada = null;
    if (claveNueva) {
      if (String(claveNueva).length < 6) {
        return res.status(400).json({ ok: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
      }
      if (!claveActual) {
        return res.status(400).json({ ok: false, message: 'Indica tu contraseña actual para cambiarla' });
      }
      // Las cuentas antiguas pueden tener la clave en texto plano; se aceptan y
      // quedan migradas al guardar el nuevo hash.
      const claveGuardada = actualRes.rows[0].clave;
      const esHashBcrypt = /^\$2[aby]\$\d{2}\$/.test(claveGuardada);
      const actualValida = esHashBcrypt
        ? await bcrypt.compare(String(claveActual), claveGuardada)
        : String(claveActual) === claveGuardada;
      if (!actualValida) {
        return res.status(403).json({ ok: false, message: 'La contraseña actual no es correcta' });
      }
      claveHasheada = await bcrypt.hash(String(claveNueva), 10);
    }

    const resultado = await db.query(
      `
        UPDATE usuario
        SET nombre   = COALESCE($1, nombre),
            apellido = COALESCE($2, apellido),
            correo   = COALESCE($3, correo),
            telefono = COALESCE($4, telefono),
            clave    = COALESCE($5, clave)
        WHERE "usuarioID" = $6
        RETURNING "usuarioID", nombre, apellido, correo, telefono, rol
      `,
      [
        nombre === undefined ? null : String(nombre).trim(),
        apellido === undefined ? null : String(apellido).trim(),
        correo === undefined ? null : String(correo).trim(),
        telefono === undefined ? null : String(telefono).trim(),
        claveHasheada,
        usuarioId
      ]
    );

    res.json({
      ok: true,
      message: 'Perfil actualizado exitosamente',
      usuario: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar el perfil:', error);
    if (error.code === '23505') {
      return res.status(400).json({ ok: false, message: 'Ese correo ya está registrado por otra cuenta' });
    }
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

module.exports = {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  actualizarMiPerfil
};