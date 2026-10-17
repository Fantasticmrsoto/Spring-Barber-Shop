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
