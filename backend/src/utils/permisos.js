/*
 * Comprobaciones de propiedad sobre los datos de un barbero.
 *
 * Hay varias rutas donde el permiso depende de *de quién* es el barbero: su
 * horario, sus servicios, su ficha. La ruta deja pasar al administrador y al
 * barbero, y es aquí donde se decide si el barbero que llama es el dueño de
 * esos datos.
 *
 * Sin esta comprobación, un barbero autenticado podía tocar el horario o los
 * servicios de cualquier otro barbero de la peluquería (y de paso, dejar sin
 * servicio a un compañero o moverle la agenda).
 */

const db = require('../config/db');

/**
 * ¿El usuario del token puede administrar los datos de este barbero?
 *
 *   - El administrador puede con todos.
 *   - El barbero, solo con los suyos.
 *   - Cualquier otro rol, con ninguno.
 *
 * @param {number} barberoId
 * @param {{usuarioID?: number, rol?: string}} usuario  Claims del token.
 * @returns {Promise<boolean>}
 */
const esAdministradorDeBarbero = async (barberoId, usuario) => {
  if (!usuario) return false;
  if (usuario.rol === 'administrador') return true;
  if (usuario.rol !== 'barbero') return false;

  const resultado = await db.query(
    'SELECT "usuarioID" FROM barbero WHERE "barberoID" = $1',
    [barberoId]
  );

  return resultado.rows.length > 0 && resultado.rows[0].usuarioID === usuario.usuarioID;
};

/**
 * Atajo para responder 403 cuando no es el suyo.
 *
 * @param {import('express').Response} res
 * @param {string} mensaje
 */
const forbiddenNoEsSuBarbero = (res, mensaje) =>
  res.status(403).json({ ok: false, message: mensaje });

module.exports = { esAdministradorDeBarbero, forbiddenNoEsSuBarbero };
