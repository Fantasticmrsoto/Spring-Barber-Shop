const express = require('express');
const { obtenerFeriados } = require('../controllers/feriadoController');

const router = express.Router();

// Pública: la web la consulta antes de que el cliente haya iniciado sesión.
router.get('/', obtenerFeriados);

module.exports = router;
