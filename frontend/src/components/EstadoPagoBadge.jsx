import { ESTADOS_PAGO, etiquetaPago } from '../utils/pago'

export default function EstadoPagoBadge({ estado, metodo, className = '' }) {
  if (!estado) return null
  const e = ESTADOS_PAGO[estado] ?? { label: estado, clase: 'bg-white/10 text-cream-200' }
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider ${e.clase} ${className}`}
    >
      {etiquetaPago(estado, metodo) ?? e.label}
    </span>
  )
}
