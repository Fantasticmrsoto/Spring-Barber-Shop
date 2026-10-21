const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

// Exige un header `Authorization: Bearer <token>` y adjunta los claims en req.usuario
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    const expirado = error.name === 'TokenExpiredError';
    return res.status(401).json({
      ok: false,
      message: expirado ? 'Token expirado.' : 'Token inválido.'
    });
  }
};

// Autenticación opcional: si hay token, se valida y se adjunta a req.usuario;
// si no hay token (o no es válido), la petición sigue su curso como anónima.
//
// Se usa en las rutas donde el mismo endpoint tiene dos comportamientos según
// quién llama: por ejemplo, el alta de usuarios es pública, pero solo un
// administrador puede dar de alta a otro administrador. Con `verificarToken` la
// ruta pública quedaría cerrada; con este middleware, el Visitante sigue
// pudiendo registrarse y el administrador conserva sus permisos.
const verificarTokenOpcional = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return next();

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
  } catch {
    // Un token inválido no rompe la petición: se trata como anónima.
    req.usuario = undefined;
  }
  next();
};

// Uso: verificarRol(['administrador', 'barbero'])
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ ok: false, message: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
};

module.exports = {
  verificarToken,
  verificarTokenOpcional,
  verificarRol
};
