import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import logo from '../assets/logo-spring.jpg'

export default function Navbar() {
  const { usuario } = useAuth()

  const rutaPanel =
    usuario?.rol === 'administrador'
      ? '/admin'
      : usuario?.rol === 'barbero'
        ? '/barbero'
        : '/mis-citas'
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link to="/" className="flex items-center">
          <img
            src={logo}
            alt="Spring Barber Shop"
            className="h-24 w-24 rounded-full object-cover shadow-lg shadow-black/50 sm:h-28 sm:w-28"
          />
        </Link>

        <div className="hidden items-center gap-8 text-base uppercase tracking-wider text-cream-200 md:flex">
          <a href="#servicios" className="transition hover:text-gold-400">
            Servicios
          </a>
          <a href="#barberos" className="transition hover:text-gold-400">
            Barberos
          </a>
          <a href="#contacto" className="transition hover:text-gold-400">
            Contacto
          </a>
        </div>

        {usuario ? (
          <Link
            to={rutaPanel}
            className="rounded-full bg-gold-500 px-6 py-2.5 text-base font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
          >
            Mi cuenta
          </Link>
        ) : (
          <Link
            to="/login"
            className="rounded-full bg-gold-500 px-6 py-2.5 text-base font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
          >
            Iniciar sesión
          </Link>
        )}
      </nav>
    </header>
  )
}
