import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

// Menú lateral (off-canvas) para móvil.
//
// Se monta en un portal sobre `document.body` a propósito: la cabecera usa
// `backdrop-blur`, y cualquier ancestro con filtro crea el bloque contenedor
// de los hijos en `position: fixed`, lo que dejaría el panel anclado a la
// cabecera en vez de a la pantalla.

export function IconoHamburguesa({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  )
}

export function IconoCerrar({ className = 'h-5 w-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

// Clase reutilizable para los enlaces del menú lateral.
export const enlaceMenu =
  'block rounded-xl px-4 py-3 text-base uppercase tracking-wider text-cream-200 transition hover:bg-white/5 hover:text-gold-300'

export default function MenuMovil({ abierto, onCerrar, titulo = 'Menú', children }) {
  // `useLayoutEffect` (y no `useEffect`) para que el bloqueo de scroll del
  // cuerpo se levante de forma síncrona al cerrar: así el salto a un ancla
  // disparado en el mismo clic sí encuentra la página con scroll habilitado.
  useLayoutEffect(() => {
    if (!abierto) return
    const alTeclear = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alTeclear)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflowPrevio
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onCerrar}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col overflow-y-auto overscroll-contain border-l border-white/10 bg-ink-900 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <p className="font-display text-sm uppercase tracking-widest text-gold-400">
            {titulo}
          </p>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 text-cream-200/70 transition hover:border-gold-400 hover:text-gold-300"
          >
            <IconoCerrar />
          </button>
        </div>

        <div className="flex flex-col gap-1 p-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
