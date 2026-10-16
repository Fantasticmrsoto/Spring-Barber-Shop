const express = require('express');
const router = express.Router();
const {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  actualizarMiPerfil
} = require('../controllers/usuarioController');
const { verificarToken } = require('../middlewares/authMiddleware');

// PUT /api/usuarios/perfil -> El usuario edita su propio perfil. Debe ir antes que
// '/:id' para que 'perfil' no se interprete como un ID.
router.put('/perfil', verificarToken, actualizarMiPerfil);

// GET /api/usuarios -> Obtener lista completa
router.get('/', obtenerUsuarios);

// GET /api/usuarios/:id -> Obtener por ID
router.get('/:id', obtenerUsuarioPorId);

// POST /api/usuarios -> Registrar un nuevo usuario
router.post('/', crearUsuario);

// PUT /api/usuarios/:id -> Actualizar usuario
router.put('/:id', actualizarUsuario);

// DELETE /api/usuarios/:id -> Eliminar usuario
router.delete('/:id', eliminarUsuario);

module.exports = router;