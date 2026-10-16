import logo from '../assets/logo-spring.jpg'

export default function Cargando() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-950">
      <img
        src={logo}
        alt="Spring Barber Shop"
        className="h-28 w-28 rounded-full object-cover shadow-lg shadow-black/50"
      />
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
      <p className="text-sm uppercase tracking-widest text-cream-200/60">
        Cargando…
      </p>
    </div>
  )
}
