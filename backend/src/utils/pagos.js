/*
 * Pagos de una cita: lo que el cliente elige al reservar y lo que el
 * administrador hace con el comprobante.
 *
 * Vive aparte porque lo usan dos controladores:
 *
 *   - `citaController` (reservar): guarda el método de pago elegido y, si es
 *     pago móvil, el comprobante que sube el cliente.
 *   - `transaccionController` (revisar): aprueba o rechaza el comprobante, y
 *     eso se refleja en la cita.
 *
 * Los estados del pago son los mismos que los de `transacciones.estado`
 * (pendiente, completado, rechazado) para que las dos piezas hablen el mismo
 * idioma: la etiqueta que ve el cliente sale de la cita y la fila que ve el
 * administrador sale de la transacción.
 */

// Métodos de pago que admiten `transacciones.metodo_pago` y `cita.pago_metodo`.
const METODOS_PAGO = ['efectivo', 'tarjeta', 'pago_movil'];

// Estados del pago de una cita.
const ESTADOS_PAGO = ['pendiente', 'completado', 'rechazado'];

/**
 * Normaliza el método de pago que llega en el cuerpo de la petición.
 *
 * @param {*} valor  Lo que viene del cliente (o del formulario).
 * @returns {{metodo: string|null, error: string|null}} Si el método no es
 *   válido, `error` trae el mensaje para el usuario.
 */
const leerMetodoPago = (valor) => {
  if (valor === undefined || valor === null || valor === '') {
    return { metodo: null, error: null };
  }

  const metodo = String(valor).trim().toLowerCase();

  if (!METODOS_PAGO.includes(metodo)) {
    return {
      metodo: null,
      error: `El método de pago debe ser uno de: ${METODOS_PAGO.join(', ')}`,
    };
  }

  return { metodo, error: null };
};

/**
 * Deja la cita con la etiqueta de su pago.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} datos
 * @param {number} datos.citaId
 * @param {string} datos.metodo   'efectivo' | 'tarjeta' | 'pago_movil'
 * @param {string} datos.estado   'pendiente' | 'completado' | 'rechazado'
 */
const marcarPagoCita = async (client, { citaId, metodo, estado }) => {
  await client.query(
    `UPDATE cita
     SET pago_metodo = $2,
         pago_estado = $3
     WHERE "citaID" = $1`,
    [citaId, metodo, estado]
  );
};

/**
 * Registra el pago de una cita: la fila de `transacciones` (con el
 * comprobante y la referencia) y la etiqueta de la cita.
 *
 * Se hacen las dos cosas con la misma conexión para que no quede una cita con
 * la etiqueta puesta y sin su comprobante (ni al revés).
 *
 * @param {import('pg').PoolClient} client
 * @param {object} datos
 * @param {number} datos.citaId
 * @param {number|null} datos.clienteId  NULL en las citas de invitado.
 * @param {string} datos.metodo
 * @param {string} datos.estado
 * @param {number} datos.monto
 * @param {string|null} datos.referencia
 * @param {string|null} datos.comprobante  Ruta pública del archivo subido.
 * @returns {Promise<object>} La transacción insertada.
 */
const registrarPagoCita = async (client, {
  citaId,
  clienteId = null,
  metodo,
  estado,
  monto,
  referencia = null,
  comprobante = null,
}) => {
  const insercion = await client.query(
    `INSERT INTO transacciones ("citaID", "usuarioID", metodo_pago, estado, monto, referencia_pago, comprobante_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING "transaccionID", "citaID", metodo_pago, estado, monto, referencia_pago, comprobante_url, fecha_creacion;`,
    [citaId, clienteId, metodo, estado, monto, referencia, comprobante]
  );

  await marcarPagoCita(client, { citaId, metodo, estado });

  return insercion.rows[0];
};

/**
 * El administrador aprueba el comprobante.
 *
 * El pago queda completado y la cita sigue su curso normal: si estaba
 * pendiente (esperando el visto bueno) pasa a confirmada. Una cita ya
 * completada o cancelada no se toca.
 *
 * @param {import('pg').PoolClient} client
 * @param {object} datos
 * @param {number} datos.citaId
 * @param {string|null} datos.metodo
 */
const aprobarPagoCita = async (client, { citaId, metodo = null }) => {
  await client.query(
    `UPDATE cita
     SET pago_metodo = COALESCE(pago_metodo, $2),
         pago_estado = 'completado',
         motivo_pago = NULL,
         estado = CASE WHEN estado = 'pendiente' THEN 'confirmada' ELSE estado END
     WHERE "citaID" = $1`,
    [citaId, metodo]
  );
};

/**
 * El administrador rechaza el comprobante.
 *
 * La cita queda denegada (no cancelada: la canceló el administrador) y se
 * guarda el motivo, que es el mensaje que ve el cliente en "Mis citas".
 *
 * @param {import('pg').PoolClient} client
 * @param {object} datos
 * @param {number} datos.citaId
 * @param {string} datos.motivo
 */
const rechazarPagoCita = async (client, { citaId, motivo }) => {
  await client.query(
    `UPDATE cita
     SET pago_estado = 'rechazado',
         motivo_pago = $2,
         estado = CASE WHEN estado IN ('pendiente', 'confirmada') THEN 'denegada' ELSE estado END
     WHERE "citaID" = $1`,
    [citaId, motivo]
  );
};

module.exports = {
  METODOS_PAGO,
  ESTADOS_PAGO,
  leerMetodoPago,
  marcarPagoCita,
  registrarPagoCita,
  aprobarPagoCita,
  rechazarPagoCita,
};
