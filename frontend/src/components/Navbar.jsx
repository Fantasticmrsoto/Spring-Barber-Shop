import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import logo from '../assets/logo-spring.jpg'
import MenuMovil, { IconoHamburguesa, enlaceMenu } from './MenuMovil'

const SECCIONES = [
  { etiqueta: 'Servicios', ancla: 'servicios' },
  { etiqueta: 'Barberos', ancla: 'barberos' },
  { etiqueta: 'Contacto', ancla: 'contacto' },
]

export default function Navbar() {
  const { usuario } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const rutaPanel =
    usuario?.rol === 'administrador'
      ? '/admin'
      : usuario?.rol === 'barbero'
        ? '/barbero'
        : '/mis-citas'

  // El menú lateral bloquea el scroll del cuerpo, así que el salto al ancla se
  // hace después de cerrarlo para que el navegador pueda desplazarse.
  function irA(ancla) {
    setMenuAbierto(false)
    setTimeout(() => {
      document.getElementById(ancla)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src={logo}
            alt="Spring Barber Shop"
            className="h-12 w-12 rounded-full object-cover shadow-lg shadow-black/50 sm:h-16 sm:w-16 md:h-24 md:w-24"
          />
        </Link>

        <div className="hidden items-center gap-8 text-base uppercase tracking-wider text-cream-200 md:flex">
          {SECCIONES.map(({ etiqueta, ancla }) => (
            <a key={ancla} href={`#${ancla}`} className="transition hover:text-gold-400">
              {etiqueta}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={usuario ? rutaPanel : '/login'}
            className="rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400 sm:px-6 sm:py-2.5 sm:text-base"
          >
            {usuario ? 'Mi cuenta' : 'Entrar'}
          </Link>

          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-cream-200 transition hover:border-gold-400 hover:text-gold-300 md:hidden"
          >
            <IconoHamburguesa />
          </button>
        </div>
      </nav>

      <MenuMovil abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} titulo="Spring Barber Shop">
        {SECCIONES.map(({ etiqueta, ancla }) => (
          <a
            key={ancla}
            href={`#${ancla}`}
            onClick={(e) => {
              e.preventDefault()
              irA(ancla)
            }}
            className={enlaceMenu}
          >
            {etiqueta}
          </a>
        ))}

        <Link to="/reservar" onClick={() => setMenuAbierto(false)} className={enlaceMenu}>
          Reservar cita
        </Link>

        <Link
          to={usuario ? rutaPanel : '/login'}
          onClick={() => setMenuAbierto(false)}
          className="mt-2 rounded-full bg-gold-500 px-5 py-3 text-center text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
        >
          {usuario ? 'Mi cuenta' : 'Iniciar sesión'}
        </Link>
      </MenuMovil>
    </header>
  )
}
