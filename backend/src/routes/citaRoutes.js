const express = require('express');
const router = express.Router();
const {
  obtenerCitas,
  obtenerOcupados,
  crearCita,
  crearCitaPublica,
  obtenerCitaPublica,
  cancelarCitaPublica,
  reprogramarCita,
  actualizarEstadoCita
} = require('../controllers/citaController');
const { verificarToken } = require('../middlewares/authMiddleware');

/*
 * Citas.
 *
 * Hay dos caminos:
 *
 *   - **Con sesión**: el cliente agenda, ve y cancela sus citas; el barbero
 *     gestiona su agenda; el administrador lo ve todo.
 *   - **Sin sesión** (público): quien reserva sin cuenta necesita un par de
 *     endpoints para poder consultar y cancelar su reserva, porque no tiene
 *     con qué autenticarse. Se identifica con el código que recibe al reservar.
 */

// --- Rutas públicas ------------------------------------------------------

// Horas ocupadas de un barbero: la web las consulta antes de que el cliente
// haya iniciado sesión, para no ofrecer horas que el servidor va a rechazar.
router.get('/ocupados', obtenerOcupados);

// Reserva sin cuenta. Devuelve el código con el que el cliente podrá volver
// a su cita (página /cita/<codigo>).
router.post('/publica', crearCitaPublica);

// Consultar una cita con su código.
router.get('/publica/:codigo', obtenerCitaPublica);

// Cancelar una cita con su código. Solo se puede cancelar si la cita sigue
// en pie (pendiente o confirmada).
router.put('/publica/:codigo/estado', cancelarCitaPublica);

// --- Rutas con sesión ----------------------------------------------------

// Listado de citas. Cada rol ve solo lo que le corresponde (lo decide el
// controlador, porque el filtro depende del rol).
router.get('/', verificarToken, obtenerCitas);

// Crear una cita con cuenta.
router.post('/', verificarToken, crearCita);

// Cambiar el estado de una cita.
// Los permisos se comprueban en el controlador: el administrador puede cambiar
// cualquier estado, el barbero solo los de su agenda y el cliente solo puede
// cancelar sus propias citas.
router.put('/:id/estado', verificarToken, actualizarEstadoCita);

// Reprogramar una cita (cambiar su fecha y hora). Las rutas de `publica` se
// han declarado antes que `/:id` para que Express no las confunda.
router.put('/:id', verificarToken, reprogramarCita);

module.exports = router;
