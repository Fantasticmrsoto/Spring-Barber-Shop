const db = require('../config/db');
const { errorInterno } = require('../utils/respuestaError');
const { DIAS_DESCANSO } = require('../config/calendario');
const { fechaYmd } = require('../utils/validacion');

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

module.exports = { obtenerFeriados };
