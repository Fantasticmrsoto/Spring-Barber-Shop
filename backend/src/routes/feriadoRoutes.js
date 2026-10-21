const express = require('express');
const { obtenerFeriados, crearFeriado, eliminarFeriado } = require('../controllers/feriadoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

const router = express.Router();

// Pública: la web la consulta antes de que el cliente haya iniciado sesión.
router.get('/', obtenerFeriados);

// Añadir y quitar días no laborables es una acción de administración.
router.post('/', verificarToken, verificarRol(['administrador']), crearFeriado);
router.delete('/:fecha', verificarToken, verificarRol(['administrador']), eliminarFeriado);

module.exports = router;
