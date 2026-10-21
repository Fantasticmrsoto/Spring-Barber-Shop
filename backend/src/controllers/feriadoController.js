const db = require('../config/db');
const { errorInterno } = require('../utils/respuestaError');
const { DIAS_DESCANSO } = require('../config/calendario');
const { fechaYmd } = require('../utils/validacion');

// Tipos que admite el CHECK `feriado_tipo_check` de la migración 007.
const TIPOS_FERIADO = ['festivo', 'religioso', 'carnaval'];

// 1. Días en los que no se puede reservar
//
// Es pública: la web la necesita antes de que el cliente haya iniciado
// sesión, para no ofrecer unas fechas que el servidor va a rechazar.
const obtenerFeriados = async (req, res) => {
  try {
    const resultado = await db.query(
      'SELECT fecha, nombre, tipo FROM feriado ORDER BY fecha ASC'
    );

    res.json({
      ok: true,
      // Los domingos no se guardan en la tabla: se deducen del día de la
      // semana. Se devuelven aquí para que la web no tenga que duplicar la
      // regla.
      dias_descanso: DIAS_DESCANSO,
      feriados: resultado.rows.map((f) => ({
        // La fecha se formatea con las partes locales: `toISOString()`
        // convertiría a UTC y en husos horarios positivos se perdería un día.
        fecha: fechaYmd(f.fecha),
        nombre: f.nombre,
        tipo: f.tipo
      }))
    });
  } catch (error) {
    errorInterno(res, error, 'Obtener Feriados');
  }
};

// 2. Registrar un día no laborable
//
// Los feriados cambian cada año y los carnavales y la Semana Santa se mueven
// con la Pascua, así que hay que poder añadirlos sin tocar la base a mano.
// Es una acción de administración.
const crearFeriado = async (req, res) => {
  const { fecha, nombre, tipo } = req.body || {};

  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
    return res.status(400).json({
      ok: false,
      message: 'La fecha es obligatoria y debe tener el formato AAAA-MM-DD'
    });
  }

  if (typeof nombre !== 'string' || !nombre.trim()) {
    return res.status(400).json({
      ok: false,
      message: 'El nombre del feriado es obligatorio'
    });
  }

  const tipoValor = tipo === undefined || tipo === null || tipo === '' ? 'festivo' : tipo;

  if (!TIPOS_FERIADO.includes(tipoValor)) {
    return res.status(400).json({
      ok: false,
      message: `El tipo debe ser uno de: ${TIPOS_FERIADO.join(', ')}`
    });
  }

  try {
    const resultado = await db.query(
      `INSERT INTO feriado (fecha, nombre, tipo)
       VALUES ($1, $2, $3)
       ON CONFLICT (fecha) DO NOTHING
       RETURNING fecha, nombre, tipo;`,
      [fecha.trim(), nombre.trim(), tipoValor]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Ya hay un feriado registrado para esa fecha'
      });
    }

    res.status(201).json({
      ok: true,
      message: 'Feriado registrado exitosamente',
      feriado: {
        fecha: fechaYmd(resultado.rows[0].fecha),
        nombre: resultado.rows[0].nombre,
        tipo: resultado.rows[0].tipo,
      }
    });
  } catch (error) {
    if (error.code === '22007') {
      // Fecha que no existe (por ejemplo, 2026-02-30).
      return res.status(400).json({ ok: false, message: 'La fecha no es válida' });
    }
    errorInterno(res, error, 'Crear Feriado');
  }
};

// 3. Quitar un día no laborable
const eliminarFeriado = async (req, res) => {
  const { fecha } = req.params;

  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
    return res.status(400).json({
      ok: false,
      message: 'La fecha debe tener el formato AAAA-MM-DD'
    });
  }

  try {
    const resultado = await db.query(
      'DELETE FROM feriado WHERE fecha = $1 RETURNING fecha, nombre, tipo;',
      [fecha.trim()]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'No hay ningún feriado en esa fecha' });
    }

    res.json({
      ok: true,
      message: 'Feriado eliminado exitosamente',
      feriado: {
        fecha: fechaYmd(resultado.rows[0].fecha),
        nombre: resultado.rows[0].nombre,
        tipo: resultado.rows[0].tipo,
      }
    });
  } catch (error) {
    errorInterno(res, error, 'Eliminar Feriado');
  }
};

module.exports = { obtenerFeriados, crearFeriado, eliminarFeriado };
