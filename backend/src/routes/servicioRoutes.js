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

router.get('/', obtenerServicios);

router.get('/:id', obtenerServicioPorId);

// Crear un servicio también es una acción de administración: el catálogo es
// de la peluquería, no de cada cliente.
router.post('/', verificarToken, verificarRol(['administrador']), crearServicio);

// Editar y eliminar un servicio es una acción de administración: el catálogo
// es de la peluquería, no de cada cliente.
router.put('/:id', verificarToken, verificarRol(['administrador']), actualizarServicio);
router.delete('/:id', verificarToken, verificarRol(['administrador']), eliminarServicio);

module.exports = router;
