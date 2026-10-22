// Etiquetas y estilos del estado y método de pago, compartidos entre la vista
// del cliente y la gestión del administrador.
export const ESTADOS_PAGO = {
  pendiente: { label: 'Pago en revisión', clase: 'bg-amber-500/15 text-amber-300' },
  completado: { label: 'Pagado', clase: 'bg-emerald-500/15 text-emerald-300' },
  rechazado: { label: 'Pago rechazado', clase: 'bg-red-500/15 text-red-300' },
}

export const METODOS_PAGO = {
  pago_movil: 'Pago móvil',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
}

/*
 * Etiqueta del pago de una cita.
 *
 * El estado solo no alcanza para explicarle al cliente qué está pasando: un
 * pago móvil "pendiente" está esperando que el administrador revise el
 * comprobante, mientras que uno en efectivo "pendiente" está esperando a que
 * el cliente pague en el local. Con el método se distinguen los dos casos.
 */
const ETIQUETAS_PAGO = {
  pendiente: {
    pago_movil: 'Comprobante en revisión',
    local: 'Pago pendiente',
  },
  completado: {
    pago_movil: 'Pago móvil aprobado',
    local: 'Pagado',
  },
  rechazado: 'Pago rechazado',
}

/**
 * Texto de la etiqueta del pago de una cita.
 *
 * @param {string|null} estado   'pendiente' | 'completado' | 'rechazado'
 * @param {string|null} metodo   'pago_movil' | 'efectivo' | 'tarjeta'
 * @returns {string|null}
 */
export function etiquetaPago(estado, metodo) {
  if (!estado) return null
  if (estado === 'rechazado') return ETIQUETAS_PAGO.rechazado

  const grupo = ETIQUETAS_PAGO[estado]
  if (!grupo) return estado

  return metodo === 'pago_movil' ? grupo.pago_movil : grupo.local
}

/*
 * Estados de una cita, con su etiqueta y su color.
 *
 * La lista estaba duplicada en tres ficheros (ListaCitas, CitaPublica y
 * MisCitas) y ya se había desincronizado: uno usaba "Confirmada" y otro
 * "confirmada". Los estados son los del CHECK `cita_estado_check` de la base
 * de datos.
 *
 * "denegada" la pone el administrador cuando rechaza el comprobante de un
 * pago móvil: la cita no se perdió, se le negó.
 */
export const ESTADOS_CITA = {
  pendiente: { label: 'Pendiente', clase: 'bg-amber-500/15 text-amber-300' },
  confirmada: { label: 'Confirmada', clase: 'bg-sky-500/15 text-sky-300' },
  completada: { label: 'Completada', clase: 'bg-emerald-500/15 text-emerald-300' },
  cancelada: { label: 'Cancelada', clase: 'bg-red-500/15 text-red-300' },
  denegada: { label: 'Denegada', clase: 'bg-red-500/15 text-red-300' },
  cancelacion_solicitada: { label: 'Cancelación solicitada', clase: 'bg-orange-500/15 text-orange-300' },
}

/*
 * Mensaje que ve el cliente cuando el administrador deniega su cita.
 *
 * @param {object} cita
 * @returns {string|null}
 */
export function mensajeDenegacion(cita) {
  if (!cita || cita.pago_estado !== 'rechazado') return null
  const motivo = cita.motivo_pago ? ` Motivo: ${cita.motivo_pago}` : ''
  return `Tu cita fue denegada porque el comprobante del pago no fue aprobado.${motivo}`
}
