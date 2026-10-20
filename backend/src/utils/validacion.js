/*
 * Utilidades de validación compartidas por los controladores.
 *
 * Antes de este módulo, cada controlador repetía las mismas comprobaciones:
 * `horaAMinutos` estaba copiado en citaController y horarioController, el
 * validador de ids en barberoServicioController y el patrón
 * `Number.isInteger(x) && x > 0` en una docena de sitios más, y la lista de
 * días de la semana existía en dos ficheros con dos órdenes distintos
 * (domingo primero en uno, lunes primero en el otro).
 *
 * Este módulo es la única fuente de verdad.
 */

/*
 * Días de la semana en el formato que exige el CHECK `horario_laboral_dia_check`
 * (migración 004): en minúsculas y sin tilde.
 *
 * El orden es lunes → domingo. Para convertir una fecha al nombre del día se
 * usa `nombreDia()`, que tiene en cuenta que `Date.getDay()` devuelve 0 para
 * el domingo.
 */
const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

/**
 * Nombre del día de una fecha, en el formato del CHECK de la base de datos.
 * @param {Date} fecha
 * @returns {string}
 */
const nombreDia = (fecha) => DIAS_SEMANA[(fecha.getDay() + 6) % 7];

/**
 * Convierte una hora "HH:MM" o "HH:MM:SS" a minutos desde medianoche.
 * @param {string} hora
 * @returns {number}
 */
const horaAMinutos = (hora) => {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + m;
};

/**
 * Valida el formato de hora que espera PostgreSQL para un tipo `time`.
 * @param {*} valor
 * @returns {boolean}
 */
const esHoraValida = (valor) =>
  typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(valor.trim());

/**
 * Valida que un id de ruta o del body sea un entero positivo.
 * @param {*} valor
 * @returns {number|null} El id, o null si no es válido.
 */
const idValido = (valor) => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Fecha en formato "YYYY-MM-DD" usando la zona horaria **local**.
 *
 * No se puede usar `toISOString()`: eso convierte a UTC, y con un desfase
 * negativo (Venezuela es UTC-4) una cita de las 22:00 del 1 de enero saldría
 * como "2026-01-02". El resto del controlador compara la cita con la hora
 * local (`getHours()`), así que la fecha debe ser local también.
 *
 * @param {Date} fecha
 * @returns {string}
 */
const fechaYmd = (fecha) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
};

/**
 * Parsea la fecha de una cita.
 *
 * El estándar dice que una fecha sin hora ("2026-01-01") se interpreta como
 * medianoche **UTC**. Con un desfase negativo (Venezuela es UTC-4) eso es
 * las 20:00 del día anterior, y la cita se guardaría en el día equivocado
 * (y el chequeo de feriados no encontraría el correcto).
 *
 * Se le añade la hora para que se interprete como hora local, que es como
 * trabaja el resto del controlador.
 *
 * @param {string|number|Date} valor
 * @returns {Date}
 */
const parsearFechaHora = (valor) => {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) {
    return new Date(`${valor.trim()}T00:00:00`);
  }
  return new Date(valor);
};

module.exports = {
  DIAS_SEMANA,
  nombreDia,
  horaAMinutos,
  esHoraValida,
  idValido,
  fechaYmd,
  parsearFechaHora,
};
