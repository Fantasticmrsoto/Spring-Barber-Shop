const express = require('express');
const router = express.Router();
const {
  obtenerBarberos,
  obtenerBarberoPorId,
  crearBarbero,
  actualizarBarbero,
  subirFotoBarbero,
  obtenerResenas,
  crearResena,
  obtenerTodasResenas,
  eliminarResena
} = require('../controllers/barberoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { subirUnaImagen } = require('../config/upload');

router.get('/', obtenerBarberos);

// Moderación de reseñas (solo administrador). Va antes de '/:id' para que 'resenas'
// no se interprete como un ID de barbero.
router.get(
  '/resenas',
  verificarToken,
  verificarRol(['administrador']),
  obtenerTodasResenas
);
router.delete(
  '/resenas/:resenaID',
  verificarToken,
  verificarRol(['administrador']),
  eliminarResena
);

// Reseñas: leer es público, escribir exige sesión (cliente con cita completada).
router.get('/:id/resenas', obtenerResenas);
router.post('/:id/resenas', verificarToken, crearResena);

router.get('/:id', obtenerBarberoPorId);
router.post('/', crearBarbero);

// El barbero edita su propio perfil; el administrador edita cualquiera.
router.put(
  '/:id',
  verificarToken,
  verificarRol(['administrador', 'barbero']),
  actualizarBarbero
);

router.post(
  '/:id/foto',
  verificarToken,
  verificarRol(['administrador', 'barbero']),
  subirUnaImagen('foto'),
  subirFotoBarbero
);

module.exports = router;
