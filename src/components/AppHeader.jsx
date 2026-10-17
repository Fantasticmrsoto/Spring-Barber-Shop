import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import logo from '../assets/logo-spring.jpg'

function enlaceClase({ isActive }) {
  return `rounded-full px-4 py-2 text-base uppercase tracking-wider transition ${
    isActive ? 'bg-gold-500/15 text-gold-300' : 'text-cream-200 hover:text-gold-400'
  }`
}

export default function AppHeader() {
  const { usuario, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  const esBarbero = usuario?.rol === 'barbero'
  const esAdmin = usuario?.rol === 'administrador'

  function salir() {
    cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3">
        <Link to="/" className="flex items-center">
          <img
            src={logo}
            alt="Spring Barber Shop"
            className="h-20 w-20 rounded-full object-cover shadow-md shadow-black/40"
          />
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 sm:order-none sm:ml-6 sm:w-auto">
          {esAdmin && (
            <NavLink to="/admin" className={enlaceClase}>
              Admin
            </NavLink>
          )}
          {esBarbero && (
            <NavLink to="/barbero" className={enlaceClase}>
              Mi agenda
            </NavLink>
          )}
          <NavLink to="/reservar" className={enlaceClase}>
            Reservar
          </NavLink>
          <NavLink to="/mis-citas" className={enlaceClase}>
            Mis citas
          </NavLink>
          <NavLink to="/perfil" className={enlaceClase}>
            Mi perfil
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-right text-xs leading-tight text-cream-200/70 sm:block">
            <span className="block font-semibold text-cream-50">
              {usuario?.nombre} {usuario?.apellido}
            </span>
            <span className="uppercase tracking-wider text-gold-400">
              {usuario?.rol}
            </span>
          </span>
          <button
            type="button"
            onClick={salir}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-cream-200 transition hover:border-red-400/60 hover:text-red-300"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
