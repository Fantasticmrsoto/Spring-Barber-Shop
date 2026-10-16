const express = require('express');
const router = express.Router();
const {
  obtenerCitas,
  obtenerOcupados,
  crearCita,
  crearCitaPublica,
  obtenerCitaPublica,
  cancelarCitaPublica,
  actualizarEstadoCita,
  reprogramarCita
} = require('../controllers/citaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// --- Rutas públicas (sin token) ---

// Ocupados de un barbero: solo horas, lo usa el wizard de reserva
router.get('/ocupados', obtenerOcupados);

// Reserva sin cuenta: crea/reutiliza el cliente por teléfono y agenda la cita
router.post('/publica', crearCitaPublica);

// Gestión de la cita por código (ver y cancelar sin sesión)
router.get('/publica/:codigo', obtenerCitaPublica);
router.put('/publica/:codigo/estado', cancelarCitaPublica);

// --- Rutas autenticadas ---

// Solo usuarios autenticados pueden ver y crear citas
router.get('/', verificarToken, obtenerCitas);
router.post('/', verificarToken, crearCita);

// Barbero/admin cambian el estado del flujo; el cliente solo puede cancelar la suya
// (el detalle de esa regla vive en el controlador).
router.put(
  '/:id/estado',
  verificarToken,
  verificarRol(['administrador', 'barbero', 'cliente']),
  actualizarEstadoCita
);

// Reprogramar (cambiar fecha/hora). El cliente solo las suyas; el admin cualquiera
// (el detalle de la regla vive en el controlador).
router.put(
  '/:id',
  verificarToken,
  verificarRol(['administrador', 'cliente']),
  reprogramarCita
);

module.exports = router;