const express = require('express');
const router = express.Router();
const {
  obtenerServicios,
  obtenerServicioPorId,
  crearServicio,
  actualizarServicio,
  eliminarServicio
} = require('../controllers/servicioController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Consulta pública (la landing y el wizard de reserva la usan sin sesión).
router.get('/', obtenerServicios);
router.get('/:id', obtenerServicioPorId);

// Alta pública (compatibilidad); la edición y el borrado son solo del administrador.
router.post('/', crearServicio);

router.put(
  '/:id',
  verificarToken,
  verificarRol(['administrador']),
  actualizarServicio
);
router.delete(
  '/:id',
  verificarToken,
  verificarRol(['administrador']),
  eliminarServicio
);

module.exports = router;
