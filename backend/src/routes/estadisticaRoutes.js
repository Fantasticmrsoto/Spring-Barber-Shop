const express = require('express');
const router = express.Router();
const { obtenerResumen } = require('../controllers/estadisticaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// El resumen de negocio es información sensible: solo el administrador.
router.get('/resumen', verificarToken, verificarRol(['administrador']), obtenerResumen);

module.exports = router;
