const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

const login = async (req, res) => {
  // `correo` puede venir como correo electrónico o como teléfono; `identificador`
  // se acepta por compatibilidad. Basta con que llegue uno de los dos.
  const { correo, telefono, identificador, password } = req.body || {};
  const credencial = (correo || telefono || identificador || '').toString().trim();

  if (!credencial || !password) {
    return res.status(400).json({
      ok: false,
      message: 'El correo o teléfono y la contraseña son obligatorios'
    });
  }

  try {
    // Si trae "@" se busca por correo; si no, por teléfono (comparando solo dígitos
    // para ignorar espacios, guiones y el prefijo +).
    const esCorreo = credencial.includes('@');
    const consulta = esCorreo
      ? `SELECT "usuarioID", nombre, apellido, correo, telefono, clave, rol
         FROM usuario WHERE correo = $1`
      : `SELECT "usuarioID", nombre, apellido, correo, telefono, clave, rol
         FROM usuario
         WHERE telefono IS NOT NULL
           AND regexp_replace(telefono, '\\D', '', 'g') = regexp_replace($1, '\\D', '', 'g')`;

    const resultado = await db.query(consulta, [credencial]);

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
    console.error('Error en el login:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
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
    console.error('Error al obtener el perfil:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

// Recuperación de contraseña sin correo saliente: se confirma la identidad con el
// correo y el teléfono de la propia cuenta (ambos deben coincidir con la misma fila)
// y entonces se permite fijar una nueva contraseña. El limitador de intentos de
// /login también protege esta ruta, para que no sirva de oráculo de fuerza bruta.
const recuperarClave = async (req, res) => {
  const { correo, telefono } = req.body || {};
  const claveNueva = req.body?.claveNueva || req.body?.clave || req.body?.password;

  const correoLimpio = String(correo || '').trim();
  const telefonoLimpio = String(telefono || '').trim();
  const digitosTelefono = telefonoLimpio.replace(/\D/g, '');

  if (!correoLimpio || digitosTelefono.length < 7 || !claveNueva) {
    return res.status(400).json({
      ok: false,
      message: 'Correo, teléfono y nueva contraseña son obligatorios'
    });
  }
  if (String(claveNueva).length < 6) {
    return res.status(400).json({ ok: false, message: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const resultado = await db.query(
      `SELECT "usuarioID", telefono FROM usuario WHERE correo = $1`,
      [correoLimpio]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ ok: false, message: 'Los datos no coinciden con ninguna cuenta' });
    }

    const usuario = resultado.rows[0];
    const digitosGuardados = String(usuario.telefono || '').replace(/\D/g, '');
    if (!digitosGuardados || digitosGuardados !== digitosTelefono) {
      return res.status(400).json({ ok: false, message: 'Los datos no coinciden con ninguna cuenta' });
    }

    const claveHasheada = await bcrypt.hash(String(claveNueva), 10);
    await db.query('UPDATE usuario SET clave = $1 WHERE "usuarioID" = $2', [
      claveHasheada,
      usuario.usuarioID
    ]);

    res.json({ ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error al recuperar la contraseña:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

module.exports = {
  login,
  obtenerPerfil,
  recuperarClave
};
