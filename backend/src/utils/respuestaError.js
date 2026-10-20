/**
 * Respuesta unificada para los fallos inesperados de los controladores.
 *
 * Hasta ahora cada controlador repetía esto:
 *
 *     console.error('Error al obtener servicios:', error);
 *     res.status(500).json({ ok: false, error: 'Error interno del servidor' });
 *
 * El detalle real se queda en el log del servidor (no se filtra al cliente,
 * que podría revelar nombres de tablas o columnas), pero hay un caso que sí
 * merece un mensaje accionable: cuando la consulta falla porque la relación
 * no existe (código 42P01 de PostgreSQL).
 *
 * Esa situación significa casi siempre que **las migraciones no se aplicaron
 * en esa base de datos**, y el mensaje genérico "Error interno del servidor"
 * no lleva a ninguna parte. Con esto, la respuesta dice exactamente qué
 * hacer.
 */

// 'relation "servicio" does not exist' → 42P01
const ESQUEMA_FALTANTE = '42P01';

const faltaElEsquema = (error) =>
  error?.code === ESQUEMA_FALTANTE ||
  /relation .* does not exist/i.test(error?.message || '');

const MENSAJE_ESQUEMA =
  'La base de datos no tiene el esquema aplicado. Ejecuta las migraciones: npm run migrate';

/**
 * @param {import('express').Response} res
 * @param {Error} error   Error original, para el log del servidor.
 * @param {string} [contexto] Qué se estaba haciendo, para el log.
 */
const errorInterno = (res, error, contexto) => {
  console.error(
    `Error${contexto ? ` en ${contexto}` : ' interno del servidor'}:`,
    error?.message || error
  );

  res.status(500).json({
    ok: false,
    error: faltaElEsquema(error) ? MENSAJE_ESQUEMA : 'Error interno del servidor',
  });
};

module.exports = { errorInterno, faltaElEsquema, MENSAJE_ESQUEMA };
