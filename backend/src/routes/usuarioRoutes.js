const express = require('express');
const router = express.Router();
const {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  actualizarPerfil,
  eliminarUsuario
} = require('../controllers/usuarioController');
const { verificarToken, verificarTokenOpcional, verificarRol } = require('../middlewares/authMiddleware');

/*
 * Usuarios.
 *
 * Casi todo el CRUD es del administrador: el listado devuelve el nombre, el
 * correo y el teléfono de todas las cuentas, así que no puede ser público.
 * Lo único público es el alta (el registro desde la web).
 */

// GET /api/usuarios -> Lista completa (solo administrador)
router.get('/', verificarToken, verificarRol(['administrador']), obtenerUsuarios);

// GET /api/usuarios/:id -> Por ID (solo administrador)
router.get('/:id', verificarToken, verificarRol(['administrador']), obtenerUsuarioPorId);

/*
 * POST /api/usuarios -> Registrar un nuevo usuario (público).
 *
 * La autenticación es opcional a propósito: el registro es público, pero el
 * `rol` del cuerpo solo se respeta si quien llama es un administrador. Sin
 * esto, cualquiera se registraba como administrador.
 */
router.post('/', verificarTokenOpcional, crearUsuario);

// PUT /api/usuarios/perfil -> El usuario edita su propio perfil (autenticado).
// Debe ir ANTES de `/:id`: sin este orden, Express capturaría "perfil" como un
// id numérico y la edición del perfil caía en el CRUD con un 400 confuso.
router.put('/perfil', verificarToken, actualizarPerfil);

// PUT /api/usuarios/:id -> Actualizar usuario (solo administrador)
router.put('/:id', verificarToken, verificarRol(['administrador']), actualizarUsuario);

// DELETE /api/usuarios/:id -> Eliminar usuario (solo administrador)
router.delete('/:id', verificarToken, verificarRol(['administrador']), eliminarUsuario);

module.exports = router;
