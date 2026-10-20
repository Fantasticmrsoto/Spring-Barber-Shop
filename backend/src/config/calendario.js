/*
 * Reglas de calendario: qué días no se puede reservar.
 *
 * La peluquería no abre los domingos: es el día de descanso. Los feriados se
 * guardan en la tabla `feriado` (migración 007), porque cambian cada año y
 * los carnavales y la Semana Santa se mueven con la Pascua.
 *
 * Estas reglas se aplican en dos sitios:
 *   - Al agendar una cita, que es donde de verdad importa: el servidor es el
 *     que dice que no, no solo el navegador.
 *   - En la web, para no ofrecer unas fechas que el servidor va a rechazar.
 */

const { nombreDia } = require('../utils/validacion');

/*
 * Días de la semana en los que no se trabaja.
 *
 * Se guardan con el mismo formato que el CHECK `horario_laboral_dia_check`:
 * minúsculas y sin tilde.
 */
const DIAS_DESCANSO = ['domingo'];

/**
 * ¿La fecha cae en un día de descanso?
 * @param {Date} fecha
 * @returns {boolean}
 */
const esDiaDeDescanso = (fecha) => DIAS_DESCANSO.includes(nombreDia(fecha));

/**
 * Texto para el usuario cuando la fecha es un día de descanso.
 * @param {Date} fecha
 * @returns {string}
 */
const mensajeDiaDeDescanso = (fecha) => {
  const dia = nombreDia(fecha);
  const nombre = {
    domingo: 'el domingo',
    lunes: 'el lunes',
    martes: 'el martes',
    miercoles: 'el miércoles',
    jueves: 'el jueves',
    viernes: 'el viernes',
    sabado: 'el sábado',
  }[dia];
  return `No se puede reservar ${nombre}: es día de descanso.`;
};

module.exports = { DIAS_DESCANSO, esDiaDeDescanso, mensajeDiaDeDescanso };
