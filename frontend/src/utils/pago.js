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
 * Estados de una cita, con su etiqueta y su color.
 *
 * La lista estaba duplicada en tres ficheros (ListaCitas, CitaPublica y
 * MisCitas) y ya se había desincronizado: uno usaba "Confirmada" y otro
 * "confirmada". Los estados son los del CHECK `cita_estado_check` de la base
 * de datos.
 */
export const ESTADOS_CITA = {
  pendiente: { label: 'Pendiente', clase: 'bg-amber-500/15 text-amber-300' },
  confirmada: { label: 'Confirmada', clase: 'bg-sky-500/15 text-sky-300' },
  completada: { label: 'Completada', clase: 'bg-emerald-500/15 text-emerald-300' },
  cancelada: { label: 'Cancelada', clase: 'bg-red-500/15 text-red-300' },
}

