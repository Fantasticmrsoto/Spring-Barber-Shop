const express = require('express');
const router = express.Router();
const {
  obtenerTransacciones,
  obtenerTransaccionPorId,
  crearTransaccion,
  aprobarTransaccion,
  rechazarTransaccion
} = require('../controllers/transaccionController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');
const { subirComprobante } = require('../config/upload');

// Pagos. El administrador ve y gestiona todos; el cliente solo ve los suyos y
// registra pagos móviles con comprobante (el controlador acota por rol).
router.get(
  '/',
  verificarToken,
  verificarRol(['administrador', 'cliente']),
  obtenerTransacciones
);

// Registrar pago. Multipart: el cliente adjunta el comprobante en el campo
// 'comprobante'; el administrador puede mandar JSON (efectivo/tarjeta).
router.post(
  '/',
  verificarToken,
  verificarRol(['administrador', 'cliente']),
  subirComprobante('comprobante'),
  crearTransaccion
);

router.get(
  '/:id',
  verificarToken,
  verificarRol(['administrador', 'cliente']),
  obtenerTransaccionPorId
);

// Aprobar / rechazar un pago pendiente: solo administración.
router.put(
  '/:id/aprobar',
  verificarToken,
  verificarRol(['administrador']),
  aprobarTransaccion
);
router.put(
  '/:id/rechazar',
  verificarToken,
  verificarRol(['administrador']),
  rechazarTransaccion
);

module.exports = router;
