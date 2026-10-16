const db = require('../config/db');

// Columnas del barbero junto con los datos de su usuario. `telefono` es el de la
// cuenta; `telefono_contacto` es el público que el barbero decide mostrar.
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
    b.telefono AS telefono_contacto,
    b.foto_url,
    COALESCE(
      (SELECT ROUND(AVG(r.calificacion)::numeric, 1) FROM resena r WHERE r."barberoID" = b."barberoID"),
      0
    ) AS promedio_calificacion,
    (SELECT count(*)::int FROM resena r WHERE r."barberoID" = b."barberoID") AS total_resenas
  FROM barbero b
  JOIN usuario u ON u."usuarioID" = b."usuarioID"
`;

// Devuelve la fila base del barbero (para comprobar existencia y propiedad).
const buscarBarbero = async (barberoID) => {
  const resultado = await db.query(
    'SELECT "barberoID", "usuarioID" FROM barbero WHERE "barberoID" = $1',
    [barberoID]
  );
  return resultado.rows[0] || null;
};

// Un barbero solo edita su propio perfil; un administrador edita cualquiera.
const puedeEditar = (req, barbero) =>
  req.usuario.rol === 'administrador' || barbero.usuarioID === req.usuario.usuarioID;

const idValido = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

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
    console.error('Error al obtener barberos:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 2. Obtener un barbero por ID
const obtenerBarberoPorId = async (req, res) => {
  const barberoId = idValido(req.params.id);

  if (!barberoId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(`${SELECT_BARBERO} WHERE b."barberoID" = $1`, [barberoId]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }

    res.json({ ok: true, barbero: resultado.rows[0] });
  } catch (error) {
    console.error('Error al obtener barbero:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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
          RETURNING "barberoID", "usuarioID", comision, estado
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
          b.telefono AS telefono_contacto,
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
    console.error('Error al crear barbero:', error);

    if (error.code === '23503') {
      return res.status(400).json({ ok: false, message: 'El usuario indicado no existe' });
    }

    if (error.code === '23505') {
      return res.status(400).json({ ok: false, message: 'El usuario ya está registrado como barbero' });
    }

    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 4. Actualizar el perfil (y, si es administrador, comisión/estado). Es parcial:
//    los campos ausentes se conservan gracias al COALESCE.
const actualizarBarbero = async (req, res) => {
  const barberoId = idValido(req.params.id);
  if (!barberoId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }

  const { descripcion, especialidad, instagram, telefono, comision, estado } = req.body || {};

  // comision y estado solo los acepta el administrador.
  const esAdmin = req.usuario.rol === 'administrador';

  let comisionNumerica = null;
  if (comision !== undefined && comision !== null && comision !== '') {
    if (!esAdmin) {
      return res.status(403).json({ ok: false, message: 'Solo un administrador puede cambiar la comisión' });
    }
    comisionNumerica = Number(comision);
    if (!Number.isFinite(comisionNumerica) || comisionNumerica < 0 || comisionNumerica > 999.99) {
      return res.status(400).json({ ok: false, message: 'La comisión debe estar entre 0 y 999.99' });
    }
  }

  let estadoValor = null;
  if (estado !== undefined) {
    if (!esAdmin) {
      return res.status(403).json({ ok: false, message: 'Solo un administrador puede activar o desactivar un barbero' });
    }
    if (typeof estado !== 'boolean') {
      return res.status(400).json({ ok: false, message: 'estado debe ser un booleano' });
    }
    estadoValor = estado;
  }

  // Normaliza: texto vacío -> null (borra el campo), texto con valor -> trim.
  const limpiar = (v) => {
    if (v === undefined) return null;
    if (v === null) return null;
    const texto = String(v).trim();
    return texto === '' ? null : texto;
  };

  try {
    const barbero = await buscarBarbero(barberoId);
    if (!barbero) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }
    if (!puedeEditar(req, barbero)) {
      return res.status(403).json({ ok: false, message: 'No puedes editar el perfil de otro barbero' });
    }

    await db.query(
      `
        UPDATE barbero
        SET descripcion  = COALESCE($1, descripcion),
            especialidad = COALESCE($2, especialidad),
            instagram    = COALESCE($3, instagram),
            telefono     = COALESCE($4, telefono),
            comision     = COALESCE($5, comision),
            estado       = COALESCE($6, estado)
        WHERE "barberoID" = $7
      `,
      [
        limpiar(descripcion),
        limpiar(especialidad),
        limpiar(instagram),
        limpiar(telefono),
        comisionNumerica,
        estadoValor,
        barberoId
      ]
    );

    const resultado = await db.query(`${SELECT_BARBERO} WHERE b."barberoID" = $1`, [barberoId]);

    res.json({
      ok: true,
      message: 'Perfil actualizado exitosamente',
      barbero: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar barbero:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 5. Subir/reemplazar la foto del barbero. Multer ya dejó el archivo en disco.
const subirFotoBarbero = async (req, res) => {
  const barberoId = idValido(req.params.id);

  if (!barberoId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'No se recibió ninguna imagen' });
  }

  try {
    const barbero = await buscarBarbero(barberoId);
    if (!barbero) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }
    if (!puedeEditar(req, barbero)) {
      return res.status(403).json({ ok: false, message: 'No puedes cambiar la foto de otro barbero' });
    }

    const rutaFoto = `/uploads/${req.file.filename}`;
    await db.query('UPDATE barbero SET foto_url = $1 WHERE "barberoID" = $2', [rutaFoto, barberoId]);

    const resultado = await db.query(`${SELECT_BARBERO} WHERE b."barberoID" = $1`, [barberoId]);

    res.status(201).json({
      ok: true,
      message: 'Foto actualizada exitosamente',
      barbero: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al subir la foto:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 6. Reseñas de un barbero (público). Incluye el promedio y el total.
const obtenerResenas = async (req, res) => {
  const barberoId = idValido(req.params.id);

  if (!barberoId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }

  try {
    const barbero = await buscarBarbero(barberoId);
    if (!barbero) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }

    const resultado = await db.query(
      `
        SELECT
          r."resenaID",
          r."usuarioID",
          r.calificacion,
          r.comentario,
          to_char(r.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion,
          u.nombre,
          u.apellido
        FROM resena r
        JOIN usuario u ON u."usuarioID" = r."usuarioID"
        WHERE r."barberoID" = $1
        ORDER BY r.fecha_creacion DESC, r."resenaID" DESC
      `,
      [barberoId]
    );

    const total = resultado.rows.length;
    const suma = resultado.rows.reduce((acc, r) => acc + Number(r.calificacion), 0);
    const promedio = total ? Number((suma / total).toFixed(1)) : 0;

    res.json({ ok: true, total, promedio, resenas: resultado.rows });
  } catch (error) {
    console.error('Error al obtener reseñas:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 7. Crear o actualizar la reseña del usuario autenticado sobre un barbero.
//    Solo se permite si el usuario ya tuvo una cita completada con ese barbero.
const crearResena = async (req, res) => {
  const barberoId = idValido(req.params.id);
  const usuarioId = req.usuario?.usuarioID;

  if (!barberoId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID del barbero debe ser un número entero válido'
    });
  }

  const { calificacion, comentario } = req.body || {};
  const calificacionNumerica = Number(calificacion);

  // Se admiten medias estrellas: múltiplos de 0.5 entre 0.5 y 5.
  if (
    calificacion === null || calificacion === '' || calificacion === undefined ||
    !Number.isFinite(calificacionNumerica) ||
    !Number.isInteger(calificacionNumerica * 2) ||
    calificacionNumerica < 0.5 || calificacionNumerica > 5
  ) {
    return res.status(400).json({
      ok: false,
      message: 'La calificación es obligatoria y debe estar entre 0.5 y 5 (en pasos de media estrella)'
    });
  }

  let comentarioTexto = null;
  if (comentario !== undefined && comentario !== null) {
    comentarioTexto = String(comentario).trim();
    if (comentarioTexto.length > 500) {
      return res.status(400).json({ ok: false, message: 'El comentario no puede superar los 500 caracteres' });
    }
    if (comentarioTexto === '') comentarioTexto = null;
  }

  try {
    const barbero = await buscarBarbero(barberoId);
    if (!barbero) {
      return res.status(404).json({ ok: false, message: 'Barbero no encontrado' });
    }

    const citaPrevia = await db.query(
      `
        SELECT 1
        FROM cita
        WHERE "clienteID" = $1 AND "barberoID" = $2 AND estado = 'completada'
        LIMIT 1
      `,
      [usuarioId, barberoId]
    );

    if (citaPrevia.rows.length === 0) {
      return res.status(403).json({
        ok: false,
        message: 'Solo puedes dejar tu reseña después de una cita completada con este barbero'
      });
    }

    const resultado = await db.query(
      `
        INSERT INTO resena ("barberoID", "usuarioID", calificacion, comentario)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("barberoID", "usuarioID")
        DO UPDATE SET
          calificacion   = EXCLUDED.calificacion,
          comentario     = EXCLUDED.comentario,
          fecha_creacion = now()
        RETURNING
          "resenaID",
          calificacion,
          comentario,
          to_char(fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion
      `,
      [barberoId, usuarioId, calificacionNumerica, comentarioTexto]
    );

    res.status(201).json({
      ok: true,
      message: 'Reseña guardada exitosamente',
      resena: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al guardar la reseña:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 8. Todas las reseñas (solo administrador), con el barbero y el autor ya unidos,
//    para poder moderar desde el panel.
const obtenerTodasResenas = async (req, res) => {
  try {
    const resultado = await db.query(
      `
        SELECT
          r."resenaID",
          r."barberoID",
          r."usuarioID",
          r.calificacion,
          r.comentario,
          to_char(r.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_creacion,
          ub.nombre   AS barbero_nombre,
          ub.apellido AS barbero_apellido,
          u.nombre    AS autor_nombre,
          u.apellido  AS autor_apellido
        FROM resena r
        JOIN barbero b  ON b."barberoID"  = r."barberoID"
        JOIN usuario ub ON ub."usuarioID" = b."usuarioID"
        JOIN usuario u  ON u."usuarioID"  = r."usuarioID"
        ORDER BY r.fecha_creacion DESC, r."resenaID" DESC
      `
    );

    res.json({ ok: true, total: resultado.rows.length, resenas: resultado.rows });
  } catch (error) {
    console.error('Error al obtener todas las reseñas:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// 9. Eliminar una reseña (solo administrador).
const eliminarResena = async (req, res) => {
  const resenaId = idValido(req.params.resenaID);

  if (!resenaId) {
    return res.status(400).json({
      ok: false,
      message: 'El ID de la reseña debe ser un número entero válido'
    });
  }

  try {
    const resultado = await db.query(
      'DELETE FROM resena WHERE "resenaID" = $1 RETURNING "resenaID"',
      [resenaId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Reseña no encontrada' });
    }

    res.json({
      ok: true,
      message: 'Reseña eliminada exitosamente',
      resenaID: resultado.rows[0].resenaID
    });
  } catch (error) {
    console.error('Error al eliminar la reseña:', error);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

module.exports = {
  obtenerBarberos,
  obtenerBarberoPorId,
  crearBarbero,
  actualizarBarbero,
  subirFotoBarbero,
  obtenerResenas,
  crearResena,
  obtenerTodasResenas,
  eliminarResena
};
