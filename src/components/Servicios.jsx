import { useEffect, useState } from 'react'
import { getServicios } from '../api/servicios'
import { mensajeDeError } from '../api/client'
import { precio, duracion } from '../utils/formato'

function Estado({ cargando, error }) {
  if (cargando) return <p className="text-cream-200/70">Cargando servicios…</p>
  if (error) return <p className="text-red-400">{error}</p>
  return null
}

export default function Servicios() {
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    getServicios()
      .then((data) => activo && setServicios(data))
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  return (
    <section id="servicios" className="border-t border-white/10 bg-ink-900">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 md:py-20">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-400">
            Carta de servicios
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl md:text-4xl">
            Lo que hacemos
          </h2>
        </div>

        <Estado cargando={cargando} error={error} />

        {!cargando && !error && servicios.length === 0 && (
          <p className="text-center text-cream-200/70">
            Todavía no hay servicios publicados.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {servicios.map((servicio) => (
            <article
              key={servicio.serviciosID}
              className="group rounded-2xl border border-white/10 bg-ink-800 p-5 transition hover:border-gold-500/50 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-cream-50 sm:text-xl">
                  {servicio.nombre}
                </h3>
                <span className="shrink-0 rounded-full bg-gold-500/15 px-3 py-1 text-sm font-semibold text-gold-300">
                  {precio(servicio.precio)}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-cream-200/80">
                {servicio.descripcion}
              </p>
              <p className="mt-4 text-xs uppercase tracking-wider text-cream-200/60">
                Duración aprox. {duracion(servicio.duracion_minutos)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
