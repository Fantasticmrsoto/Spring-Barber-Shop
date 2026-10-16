import { Link } from 'react-router-dom'
import logo from '../assets/logo-spring.jpg'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-5 text-center">
      <img
        src={logo}
        alt="Spring Barber Shop"
        className="h-32 w-32 rounded-full object-cover shadow-lg shadow-black/50"
      />
      <p className="mt-6 font-display text-5xl font-bold text-gold-400">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold uppercase tracking-wide">
        Página no encontrada
      </h1>
      <p className="mt-3 max-w-sm text-cream-200/70">
        La página que buscas no existe o cambió de dirección.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
      >
        Volver al inicio
      </Link>
    </div>
  )
}
