const express = require('express');
const router = express.Router();
const {
  obtenerTransacciones,
  crearTransaccion,
  obtenerTransaccion,
  aprobarTransaccion,
  rechazarTransaccion
} = require('../controllers/transaccionController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { subirArchivo } = require('../config/subidas');

/*
 * Ver el libro de movimientos es una acción de administración: cualquier
 * cliente autenticado podría inflarse su propio saldo_restante. La lista
 * completa (y con ella el libro de saldo) es solo del administrador.
 *
 * Los **pagos de cita** sí los registra el cliente, pero solo de sus propias
 * citas: esa comprobación la hace el controlador, no la ruta.
 */
router.get('/', verificarToken, verificarRol(['administrador']), obtenerTransacciones);
router.post(
  '/',
  verificarToken,
  verificarRol(['administrador', 'cliente', 'barbero']),
  subirArchivo.single('comprobante'),
  crearTransaccion
);

router.get('/:id', verificarToken, verificarRol(['administrador']), obtenerTransaccion);

// Aprobar o rechazar un comprobante es revisar el pago: solo el administrador.
router.put('/:id/aprobar', verificarToken, verificarRol(['administrador']), aprobarTransaccion);
router.put('/:id/rechazar', verificarToken, verificarRol(['administrador']), rechazarTransaccion);

module.exports = router;
