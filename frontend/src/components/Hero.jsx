import { Link } from 'react-router-dom'
import VideoHero from './VideoHero'

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-gold-700/10 blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-5 sm:py-16 md:grid-cols-2 md:gap-12 md:py-24">
        <div>
          <p className="mb-4 inline-block rounded-full border border-gold-500/40 px-4 py-1 text-xs uppercase tracking-[0.25em] text-gold-400">
            Barbería · Estilo clásico
          </p>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide text-cream-50 sm:text-4xl md:text-6xl">
            Tu mejor corte, <span className="text-gold-400">sin filas</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-cream-200">
            Reserva en línea con tu barbero de confianza, elige el servicio y
            asegura tu turno en segundos.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              to="/reservar"
              className="rounded-full bg-gold-500 px-7 py-3 text-center text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
            >
              Reservar cita
            </Link>
            <a
              href="#servicios"
              className="rounded-full border border-cream-200/25 px-7 py-3 text-center text-sm font-semibold uppercase tracking-wider text-cream-50 transition hover:border-gold-400 hover:text-gold-400"
            >
              Ver servicios
            </a>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-3 sm:mt-12 sm:gap-6">
            {[
              ['+8', 'años de oficio'],
              ['4', 'barberos'],
              ['100%', 'puntualidad'],
            ].map(([valor, etiqueta]) => (
              <div key={etiqueta}>
                <dt className="font-display text-xl font-bold text-gold-400 sm:text-2xl">
                  {valor}
                </dt>
                <dd className="text-[0.65rem] uppercase tracking-wider text-cream-200/70 sm:text-xs">
                  {etiqueta}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="absolute inset-0 -rotate-3 rounded-3xl border border-gold-500/30" />
          <VideoHero className="h-56 w-full rounded-3xl shadow-2xl shadow-black/50 sm:h-80 md:h-[420px]" />
        </div>
      </div>
    </section>
  )
}
