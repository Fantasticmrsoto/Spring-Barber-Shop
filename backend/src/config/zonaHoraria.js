/*
 * Zona horaria de la peluquería.
 *
 * La API guarda la *hora de pared*: una cita de las 15:00 se guarda como las
 * 15:00 y el panel la muestra a las 15:00. Eso depende de que el proceso de
 * Node interprete las fechas en la misma zona horaria que el local.
 *
 * En el portátil esa zona viene del sistema (America/Caracas), pero en la nube
 * los contenedores de Render corren en UTC: sin fijarla aquí, la cita de las
 * 15:00 se guardaría como las 15:00 UTC y en Venezuela se vería a las 11:00.
 *
 * Se fija antes de que se use ninguna fecha, y se respeta la variable de
 * entorno `TZ` si alguien quiere otra zona.
 */

const ZONA_HORARIA = process.env.TZ || 'America/Caracas';

process.env.TZ = ZONA_HORARIA;

module.exports = { ZONA_HORARIA };
