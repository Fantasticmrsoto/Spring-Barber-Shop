import { useState } from 'react'

// Dibuja una estrella con relleno parcial (0, 0.5 o 1). `valor` puede venir de
// PostgreSQL como string, por eso siempre se convierte a número.
function Estrella({ llenado }) {
  const porcentaje = Math.max(0, Math.min(1, llenado)) * 100
  return (
    <span className="relative inline-block leading-none whitespace-nowrap">
      <span className="text-cream-200/25">★</span>
      <span
        className="absolute inset-0 overflow-hidden text-gold-400"
        style={{ width: `${porcentaje}%` }}
        aria-hidden="true"
      >
        ★
      </span>
    </span>
  )
}

// Estrellas de solo lectura, con soporte de medias estrellas.
export function Estrellas({ valor = 0, className = '' }) {
  const numero = Number(valor) || 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={`${numero} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Estrella key={i} llenado={numero - (i - 1)} />
      ))}
    </span>
  )
}

// Selector interactivo de 0.5 a 5 estrellas: la mitad izquierda de cada estrella
// vale media y la derecha un entero entero.
export function SelectorEstrellas({ valor = 0, onCambiar }) {
  const [hover, setHover] = useState(0)
  const mostrado = hover || Number(valor) || 0

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative text-2xl leading-none">
          <Estrella llenado={mostrado - (i - 1)} />
          <button
            type="button"
            onClick={() => onCambiar(i - 0.5)}
            onMouseEnter={() => setHover(i - 0.5)}
            aria-label={`${i - 0.5} estrellas`}
            className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
          />
          <button
            type="button"
            onClick={() => onCambiar(i)}
            onMouseEnter={() => setHover(i)}
            aria-label={`${i} estrellas`}
            className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
          />
        </span>
      ))}
    </div>
  )
}
