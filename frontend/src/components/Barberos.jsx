import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBarberos } from '../api/barberos'
import { mensajeDeError } from '../api/client'
import { fotoBarbero } from '../utils/fotosBarbero'
import ModalBarbero from './ModalBarbero'
import { Estrellas } from './Estrellas'
import {
  aNumero,
  urlImagen,
  enlaceInstagram,
  usuarioInstagram,
  enlaceWhatsAppNumero,
} from '../utils/formato'

export default function Barberos() {
  const [barberos, setBarberos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)

  useEffect(() => {
    let activo = true
    getBarberos()
      .then((data) => activo && setBarberos(data))
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  return (
    <section id="barberos" className="border-t border-white/10">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-5 sm:py-16 md:py-20">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-400">
            El equipo
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl md:text-4xl">
            Nuestros barberos
          </h2>
        </div>

        {cargando && <p className="text-cream-200/70">Cargando barberos…</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!cargando && !error && barberos.length === 0 && (
          <p className="text-center text-cream-200/70">
            Todavía no hay barberos registrados.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {barberos.map((barbero) => {
            const instagram = enlaceInstagram(barbero.instagram)
            const telefono = barbero.telefono_contacto || barbero.telefono
            const whatsapp = enlaceWhatsAppNumero(
              telefono,
              `Hola ${barbero.nombre}, quiero reservar una cita en Spring Barber Shop.`,
            )
            // Foto de referencia para los barberos que no tienen foto subida.
            const foto = fotoBarbero(barbero.barberoID)
            return (
              <article
                key={barbero.barberoID}
                onClick={() => setSeleccionado(barbero)}
                className="flex cursor-pointer flex-col items-center rounded-2xl border border-white/10 bg-ink-800 p-5 text-center transition hover:border-gold-500/50 focus-within:border-gold-500/50 sm:p-6"
              >
                <img
                  src={barbero.foto_url ? urlImagen(barbero.foto_url) : foto.src}
                  srcSet={barbero.foto_url ? undefined : foto.srcSet}
                  sizes="80px"
                  alt={`${barbero.nombre} ${barbero.apellido}`}
                  loading="lazy"
                  decoding="async"
                  width="80"
                  height="80"
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-gold-500/60"
                />

                <h3 className="mt-4 font-display text-lg font-semibold uppercase tracking-wide">
                  {barbero.nombre} {barbero.apellido}
                </h3>

                {barbero.especialidad && (
                  <p className="mt-1 text-xs uppercase tracking-wider text-gold-400">
                    {barbero.especialidad}
                  </p>
                )}

                <div className="mt-2 flex items-center gap-2">
                  <Estrellas valor={barbero.promedio_calificacion} className="text-sm" />
                  <span className="text-xs text-cream-200/60">
                    {aNumero(barbero.promedio_calificacion).toFixed(1)} (
                    {aNumero(barbero.total_resenas)})
                  </span>
                </div>

                <span
                  className={`mt-2 rounded-full px-3 py-1 text-xs uppercase tracking-wider ${
                    barbero.estado
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/10 text-cream-200/60'
                  }`}
                >
                  {barbero.estado ? 'Disponible' : 'No disponible'}
                </span>

                {barbero.descripcion && (
                  <p className="mt-3 line-clamp-3 text-sm text-cream-200/70">
                    {barbero.descripcion}
                  </p>
                )}

                {(instagram || whatsapp) && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    {instagram && (
                      <a
                        href={instagram}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-semibold uppercase tracking-wider text-cream-200/70 transition hover:text-gold-300"
                      >
                        @{usuarioInstagram(barbero.instagram)}
                      </a>
                    )}
                    {whatsapp && (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-semibold uppercase tracking-wider text-cream-200/70 transition hover:text-gold-300"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSeleccionado(barbero)}
                    className="rounded-full border border-white/20 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-cream-200/80 transition hover:border-gold-400 hover:text-gold-300"
                  >
                    Ver reseñas
                  </button>
                  <Link
                    to={`/reservar?barbero=${barbero.barberoID}`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full border border-gold-500/50 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-gold-300 transition hover:bg-gold-500 hover:text-ink-950"
                  >
                    Reservar
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {seleccionado && (
        <ModalBarbero barbero={seleccionado} onCerrar={() => setSeleccionado(null)} />
      )}
    </section>
  )
}
