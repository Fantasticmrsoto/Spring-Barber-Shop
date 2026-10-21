const express = require('express');
const router = express.Router();
const { obtenerResumen } = require('../controllers/estadisticasController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Las métricas del negocio son del administrador: un cliente no tiene por qué
// ver los ingresos de la peluquería.
router.get('/resumen', verificarToken, verificarRol(['administrador']), obtenerResumen);

module.exports = router;
