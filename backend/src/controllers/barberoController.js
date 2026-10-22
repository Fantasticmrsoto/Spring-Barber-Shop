const db = require('../config/db');
const { errorInterno } = require('../utils/respuestaError');
const { idValido } = require('../utils/validacion');
const { rutaPublica } = require('../config/subidas');

/*
 * Ficha completa de un barbero.
 *
 * La usan el listado, el detalle y las respuestas de las acciones que lo
 * modifican, para que todas devuelvan los mismos campos.
 */
const SELECT_BARBERO = `
  SELECT
    b."barberoID",
    b."usuarioID",
    u.nombre,
    u.apellido,
    u.correo,
    u.telefono,
    b.comision,
    b.estado,
    b.descripcion,
    b.especialidad,
    b.instagram,
    b.telefono_contacto,
    b.foto_url
  FROM barbero b
  JOIN usuario u ON u."usuarioID" = b."usuarioID"
`;

// 1. Obtener todos los barberos
const obtenerBarberos = async (req, res) => {
  try {
    const resultado = await db.query(`${SELECT_BARBERO} ORDER BY b."barberoID" ASC`);

    res.json({
      ok: true,
      total: resultado.rows.length,
      barberos: resultado.rows
    });
  } catch (error) {
    errorInterno(res, error, 'Obtener Barberos');
  }
};

// 2. Obtener un barbero por ID
const obtenerBarberoPorId = async (req, res) => {
  const { id } = req.params;
  const barberoId = Number(id);

  if (!Number.isInteger(barberoId) || barberoId <= 0) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(
      `${SELECT_BARBERO} WHERE b."barberoID" = $1`,
      [barberoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }

    res.json({ ok: true, barbero: resultado.rows[0] });
  } catch (error) {
    errorInterno(res, error, 'Obtener Barbero Por Id');
  }
};

// 3. Crear un nuevo barbero
const crearBarbero = async (req, res) => {
  const { usuarioID, comision, estado } = req.body || {};
  const usuarioId = Number(usuarioID);
  const comisionNumerica = Number(comision);
  const estadoValor = estado === undefined ? true : estado;

  if (
    usuarioID === null || usuarioID === '' ||
    !Number.isInteger(usuarioId) || usuarioId <= 0 ||
    comision === null || comision === '' ||
    !Number.isFinite(comisionNumerica) || comisionNumerica < 0 || comisionNumerica > 999.99 ||
    typeof estadoValor !== 'boolean'
  ) {
    return res.status(400).json({
      ok: false,
      message: 'usuarioID, comisión y un estado booleano válido son obligatorios'
    });
  }

  try {
    const resultado = await db.query(
      `
        WITH usuario_valido AS (
          SELECT "usuarioID"
          FROM usuario
          WHERE "usuarioID" = $1
        ),
        barbero_creado AS (
          INSERT INTO barbero ("usuarioID", comision, estado)
          SELECT "usuarioID", $2, $3
          FROM usuario_valido
          RETURNING "barberoID", "usuarioID", comision, estado, descripcion,
                    especialidad, instagram, telefono_contacto, foto_url
        )
        SELECT
          b."barberoID",
          b."usuarioID",
          u.nombre,
          u.apellido,
          u.correo,
          u.telefono,
          b.comision,
          b.estado,
          b.descripcion,
          b.especialidad,
          b.instagram,
          b.telefono_contacto,
          b.foto_url
        FROM barbero_creado b
        JOIN usuario u ON u."usuarioID" = b."usuarioID"
      `,
      [usuarioId, comisionNumerica, estadoValor]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }

    res.status(201).json({
      ok: true,
      message: 'Barbero creado exitosamente',
      barbero: resultado.rows[0]
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ ok: false, message: 'El usuario indicado no existe' });
    }

    if (error.code === '23505') {
      return res.status(400).json({ ok: false, message: 'El usuario ya está registrado como barbero' });
    }

    errorInterno(res, error, 'Crear Barbero');
  }
};

/*
 * 4. Editar la ficha de un barbero
 *
 * Dos cosas se editan aquí y con permisos distintos:
 *
 *   - La **comisión** y el **estado** (activo/inactivo) son del negocio: solo
 *     el administrador los cambia.
 *   - La **ficha** (descripción, especialidad, Instagram, teléfono) la edita
 *     el propio barbero en su panel, y el administrador también puede
 *     corregirla (por ejemplo, cuando se equivoca al darla de alta).
 */
const actualizarBarbero = async (req, res) => {
  const barberoId = idValido(req.params.id);
  const esAdmin = req.usuario?.rol === 'administrador';

  if (!barberoId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }

  // Solo se desestructuran aquí `comision` y `estado`: los campos de la ficha
  // se recorren más abajo en una lista, porque cada uno necesita su propia
  // validación (texto o null).
  const { comision, estado } = req.body || {};

  const valores = {};
  const problemas = [];

  if (comision !== undefined) {
    const comisionNumerica = Number(comision);
    if (!Number.isFinite(comisionNumerica) || comisionNumerica < 0 || comisionNumerica > 999.99) {
      problemas.push('La comisión debe ser un número entre 0 y 999.99');
    } else {
      valores.comision = comisionNumerica;
    }
  }

  if (estado !== undefined) {
    if (typeof estado !== 'boolean') {
      problemas.push('El estado debe ser true (activo) o false (inactivo)');
    } else {
      valores.estado = estado;
    }
  }

  for (const campo of ['descripcion', 'especialidad', 'instagram', 'telefono_contacto']) {
    if (req.body?.[campo] === undefined) continue;
    const valor = req.body[campo];
    if (valor !== null && typeof valor !== 'string') {
      problemas.push(`El campo ${campo} debe ser un texto`);
    } else {
      valores[campo] = valor === null ? null : valor.trim();
    }
  }

  // La foto se quita mandando `foto_url: null`. Solo se aceptan las rutas que
  // genera la API al subir el archivo ("/uploads/..."): así nadie puede poner
  // una imagen de fuera ni una ruta rara.
  if (req.body?.foto_url !== undefined) {
    const valor = req.body.foto_url;
    if (valor === null) {
      valores.foto_url = null;
    } else if (typeof valor === 'string' && valor.trim().startsWith('/uploads/')) {
      valores.foto_url = valor.trim();
    } else {
      problemas.push('La foto debe ser una ruta de /uploads o null para quitarla');
    }
  }

  if (problemas.length > 0) {
    return res.status(400).json({ ok: false, message: problemas.join('. ') });
  }

  // Un barbero que no es el administrador solo puede tocar su propia ficha.
  if (!esAdmin) {
    if ('comision' in valores || 'estado' in valores) {
      return res.status(403).json({
        ok: false,
        message: 'Solo un administrador puede cambiar la comisión o el estado del barbero'
      });
    }

    const propietario = await db.query(
      'SELECT "usuarioID" FROM barbero WHERE "barberoID" = $1',
      [barberoId]
    );

    if (
      propietario.rows.length === 0 ||
      propietario.rows[0].usuarioID !== req.usuario?.usuarioID
    ) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para modificar este barbero'
      });
    }
  }

  const campos = Object.keys(valores);

  if (campos.length === 0) {
    return res.status(400).json({ ok: false, message: 'No hay nada que actualizar' });
  }

  try {
    const sets = campos.map((campo, indice) => `${campo} = $${indice + 1}`);
    const resultado = await db.query(
      `UPDATE barbero SET ${sets.join(', ')}
       WHERE "barberoID" = $${campos.length + 1}
       RETURNING "barberoID"`,
      [...campos.map((campo) => valores[campo]), barberoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }

    const actualizado = await db.query(
      `${SELECT_BARBERO} WHERE b."barberoID" = $1`,
      [barberoId]
    );

    res.json({
      ok: true,
      message: 'Barbero actualizado exitosamente',
      barbero: actualizado.rows[0]
    });
  } catch (error) {
    errorInterno(res, error, 'Actualizar Barbero');
  }
};

/*
 * 5. Subir la foto de un barbero
 *
 * El archivo lo sube multer (ver config/subidas.js) y aquí solo se guarda la
 * ruta en la base de datos. El admin puede cambiar la foto de cualquier
 * barbero; un barbero, solo la suya.
 */
const actualizarFotoBarbero = async (req, res) => {
  const barberoId = idValido(req.params.id);
  const esAdmin = req.usuario?.rol === 'administrador';

  if (!barberoId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }

  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'No se recibió ningún archivo' });
  }

  try {
    const propietario = await db.query(
      'SELECT "usuarioID" FROM barbero WHERE "barberoID" = $1',
      [barberoId]
    );

    if (propietario.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }

    if (
      !esAdmin &&
      propietario.rows[0].usuarioID !== req.usuario?.usuarioID
    ) {
      return res.status(403).json({
        ok: false,
        message: 'No tienes permisos para modificar este barbero'
      });
    }

    const ruta = rutaPublica(req.file.filename);

    await db.query(
      'UPDATE barbero SET foto_url = $1 WHERE "barberoID" = $2',
      [ruta, barberoId]
    );

    const actualizado = await db.query(
      `${SELECT_BARBERO} WHERE b."barberoID" = $1`,
      [barberoId]
    );

    res.json({
      ok: true,
      message: 'Foto actualizada exitosamente',
      barbero: actualizado.rows[0]
    });
  } catch (error) {
    errorInterno(res, error, 'Actualizar Foto Barbero');
  }
};

module.exports = {
  obtenerBarberos,
  obtenerBarberoPorId,
  crearBarbero,
  actualizarBarbero,
  actualizarFotoBarbero
};
