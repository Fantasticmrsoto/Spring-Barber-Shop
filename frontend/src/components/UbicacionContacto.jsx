import { CONTACTO } from '../config'

function IconMapPin({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 21s-6-5.686-6-10a6 6 0 1112 0c0 4.314-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  )
}

function IconPhone({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.08 4.18 2 2 0 014.06 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  )
}

function IconMail({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 4h16v16H4z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  )
}

function IconClock({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

export default function UbicacionContacto() {
  const mapsEmbed =
    'https://maps.google.com/maps?q=10.2133125,-68.0139375&z=17&hl=es&output=embed'

  return (
    <section id="ubicacion" className="bg-ink-950 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl uppercase tracking-[0.25em] text-gold-400 sm:text-4xl">
            Ubicación y contacto
          </h2>
          <p className="mt-3 text-sm text-cream-200/70">
            Encuéntranos y agenda tu cita cuando quieras
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-lg shadow-black/40">
            <iframe
              title="Ubicación de Spring Barber Shop"
              src={mapsEmbed}
              width="100%"
              height="100%"
              style={{ minHeight: '420px', border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
              <a
                href={CONTACTO.mapaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-ink-950/90 px-4 py-2 text-xs uppercase tracking-widest text-gold-400 shadow-lg shadow-black/60 transition hover:bg-gold-500 hover:text-ink-950"
              >
                Ver en Google Maps
              </a>
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-ink-900/50 p-6 shadow-lg shadow-black/40 sm:p-8">
            <h3 className="font-display text-2xl uppercase tracking-widest text-gold-400">
              Información de contacto
            </h3>

            <ul className="mt-6 space-y-5">
              <li className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10">
                  <IconMapPin className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-cream-50/90">
                    Dirección
                  </p>
                  <p className="mt-1 text-sm text-cream-200/70">
                    {CONTACTO.direccion}
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10">
                  <IconPhone className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-cream-50/90">
                    Teléfono
                  </p>
                  <p className="mt-1 text-sm text-cream-200/70">
                    {CONTACTO.telefonoVisible}
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10">
                  <IconMail className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-cream-50/90">
                    Correo
                  </p>
                  <p className="mt-1 text-sm text-cream-200/70">
                    {CONTACTO.correo}
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10">
                  <IconClock className="h-5 w-5 text-gold-400" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wider text-cream-50/90">
                    Horario
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-cream-200/70">
                    <li>Lunes a viernes · 9:00 – 19:00</li>
                    <li>Sábado · 9:00 – 17:00</li>
                    <li>Domingo · cerrado</li>
                  </ul>
                </div>
              </li>
            </ul>

            <div className="mt-8">
              <a
                href={CONTACTO.mapaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gold-500 px-6 py-3 text-sm uppercase tracking-widest text-gold-400 transition hover:bg-gold-500 hover:text-ink-950 sm:w-auto"
              >
                <IconMapPin className="h-4 w-4" />
                Abrir en Google Maps
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
