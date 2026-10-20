const bcrypt = require('bcryptjs');
const { errorInterno } = require('../utils/respuestaError');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

const login = async (req, res) => {
  const { correo, password } = req.body || {};

  if (!correo || !password) {
    return res.status(400).json({
      ok: false,
      message: 'El correo y la contraseña son obligatorios'
    });
  }

  // bcrypt exige cadenas: con un número, `compare` lanza "Illegal arguments" y
  // la petición acaba en un 500 en vez de un 400.
  if (typeof correo !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      ok: false,
      message: 'El correo y la contraseña son obligatorios'
    });
  }

  try {
    // Buscar el usuario por su correo. Se trae también `apellido` porque la
    // respuesta lo usa: sin él, `apellido` quedaba como undefined y al
    // serializar el JSON se omitía el campo entero.
    const resultado = await db.query(
      'SELECT "usuarioID", nombre, apellido, correo, clave, rol FROM usuario WHERE correo = $1',
      [correo]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales inválidas'
      });
    }

    const usuario = resultado.rows[0];

    // Verificar la contraseña. usuarioController guarda un hash bcrypt, así que lo
    // normal es comparar contra el hash. Las cuentas creadas antes de que existiera
    // el hasheo siguen con la clave en texto plano: se aceptan para no bloquear esos
    // accesos y quedan migradas cuando su dueño cambia la clave por PUT.
    const esHashBcrypt = /^\$2[aby]\$\d{2}\$/.test(usuario.clave);
    const passwordValida = esHashBcrypt
      ? await bcrypt.compare(password, usuario.clave)
      : password === usuario.clave;

    if (!passwordValida) {
      return res.status(401).json({
        ok: false,
        message: 'Credenciales inválidas'
      });
    }

    // Crear el payload para el token JWT
    const payload = {
      usuarioID: usuario.usuarioID,
      rol: usuario.rol || 'cliente'
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      ok: true,
      message: 'Inicio de sesión exitoso',
      token,
      // El frontend necesita saber cuándo renovar la sesión en lugar de
      // hardcodear la duración.
      expiresIn: JWT_EXPIRES_IN,
      usuario: {
        usuarioID: usuario.usuarioID,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol || 'cliente'
      }
    });

  } catch (error) {
    errorInterno(res, error, 'Login');
  }
};

// Perfil del usuario del token. Sin esto, una SPA que recarga la página se
// encuentra sin saber quién está autenticado ni qué rol tiene.
const obtenerPerfil = async (req, res) => {
  // verificarToken deja los claims del token en req.usuario
  const usuarioId = req.usuario.usuarioID;

  try {
    const resultado = await db.query(
      `SELECT "usuarioID", nombre, apellido, correo, telefono, rol
       FROM usuario
       WHERE "usuarioID" = $1`,
      [usuarioId]
    );

    if (resultado.rows.length === 0) {
      // El token sigue siendo válido pero la cuenta ya no existe.
      return res.status(401).json({
        ok: false,
        message: 'El usuario de este token ya no existe'
      });
    }

    res.json({ ok: true, usuario: resultado.rows[0] });
  } catch (error) {
    errorInterno(res, error, 'Obtener Perfil');
  }
};

module.exports = {
  login,
  obtenerPerfil
};
