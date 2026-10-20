import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getResenasBarbero, crearResenaBarbero } from '../api/barberos'
import { mensajeDeError } from '../api/client'
import { Estrellas, SelectorEstrellas } from './Estrellas'
import { useAuth } from '../auth/useAuth'
import {
  aNumero,
  urlImagen,
  enlaceInstagram,
  usuarioInstagram,
  enlaceWhatsAppNumero,
  capitalizar,
  fechaHora,
} from '../utils/formato'

function iniciales(nombre = '', apellido = '') {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
}

export default function ModalBarbero({ barbero, onCerrar }) {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [resenas, setResenas] = useState([])
  const [promedio, setPromedio] = useState(aNumero(barbero?.promedio_calificacion))
  const [total, setTotal] = useState(aNumero(barbero?.total_resenas))
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState({ calificacion: 0, comentario: '' })
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [avisoError, setAvisoError] = useState(false)

  // Cierra con Escape y bloquea el scroll de fondo mientras está abierto.
  useEffect(() => {
    const alTeclear = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alTeclear)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflowPrevio
    }
  }, [onCerrar])

  useEffect(() => {
    if (!barbero) return
    let activo = true
    getResenasBarbero(barbero.barberoID)
      .then((data) => {
        if (!activo) return
        setResenas(data.resenas)
        setPromedio(data.promedio)
        setTotal(data.total)
        // Si el usuario ya había reseñado, se precarga su reseña para editarla.
        const mia = data.resenas.find((r) => r.usuarioID === usuario?.usuarioID)
        if (mia) setForm({ calificacion: Number(mia.calificacion), comentario: mia.comentario || '' })
      })
      .catch(() => {})
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [barbero, usuario])

  if (!barbero) return null

  const instagram = enlaceInstagram(barbero.instagram)
  const telefono = barbero.telefono_contacto || barbero.telefono
  const whatsapp = enlaceWhatsAppNumero(
    telefono,
    `Hola ${barbero.nombre}, quiero reservar una cita en Spring Barber Shop.`,
  )
  const miResena = resenas.find((r) => r.usuarioID === usuario?.usuarioID)
  const puedeResenar = usuario?.rol === 'cliente'

  async function enviarResena(e) {
    e.preventDefault()
    if (!form.calificacion) {
      setAvisoError(true)
      setAviso('Elige una calificación de 0.5 a 5 estrellas.')
      return
    }
    setEnviando(true)
    setAviso(null)
    try {
      await crearResenaBarbero(barbero.barberoID, form)
      const data = await getResenasBarbero(barbero.barberoID)
      setResenas(data.resenas)
      setPromedio(data.promedio)
      setTotal(data.total)
      setAvisoError(false)
      setAviso('¡Gracias! Tu reseña se guardó.')
    } catch (err) {
      setAvisoError(true)
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  function reservar() {
    onCerrar()
    navigate(`/reservar?barbero=${barbero.barberoID}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Información de ${barbero.nombre} ${barbero.apellido}`}
        className="my-0 w-full max-w-2xl border border-white/10 bg-ink-900 shadow-2xl sm:my-8 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del barbero */}
        <div className="relative rounded-t-2xl border-b border-white/10 bg-gradient-to-br from-ink-800 to-ink-900 p-5 sm:p-6">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-cream-200/70 transition hover:border-gold-400 hover:text-gold-300"
          >
            ✕
          </button>

          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            {barbero.foto_url ? (
              <img
                src={urlImagen(barbero.foto_url)}
                alt={`${barbero.nombre} ${barbero.apellido}`}
                className="h-24 w-24 shrink-0 rounded-full object-cover ring-2 ring-gold-500/60"
              />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-500 to-gold-700 font-display text-3xl font-bold text-ink-950">
                {iniciales(barbero.nombre, barbero.apellido)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide">
                  {barbero.nombre} {barbero.apellido}
                </h2>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-wider ${
                    barbero.estado
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/10 text-cream-200/60'
                  }`}
                >
                  {barbero.estado ? 'Disponible' : 'No disponible'}
                </span>
              </div>

              {barbero.especialidad && (
                <p className="mt-1 text-xs uppercase tracking-wider text-gold-400">
                  {barbero.especialidad}
                </p>
              )}

              <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
                <Estrellas valor={promedio} />
                <span className="text-sm text-cream-200/70">
                  {aNumero(promedio).toFixed(1)} · {total}{' '}
                  {total === 1 ? 'reseña' : 'reseñas'}
                </span>
              </div>
            </div>
          </div>

          {barbero.descripcion && (
            <p className="mt-4 text-sm text-cream-200/75">{barbero.descripcion}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reservar}
              disabled={!barbero.estado}
              className="rounded-full bg-gold-500 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reservar con {barbero.nombre}
            </button>
            {instagram && (
              <a
                href={instagram}
                target="_blank"
                rel="noreferrer"
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
                className="text-xs font-semibold uppercase tracking-wider text-cream-200/70 transition hover:text-gold-300"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Reseñas */}
        <div className="p-5 sm:p-6">
          <h3 className="font-display text-lg uppercase tracking-wide">Reseñas</h3>

          {/* Formulario para dejar/editar la reseña */}
          {puedeResenar ? (
            <form
              onSubmit={enviarResena}
              className="mt-4 rounded-xl border border-white/10 bg-ink-800 p-4"
            >
              <p className="text-xs uppercase tracking-wider text-cream-200/70">
                {miResena ? 'Edita tu reseña' : 'Deja tu reseña'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <SelectorEstrellas
                  valor={form.calificacion}
                  onCambiar={(calificacion) => setForm((f) => ({ ...f, calificacion }))}
                />
                <span className="text-sm text-cream-200/60">
                  {form.calificacion ? `${form.calificacion} de 5` : 'Sin calificar'}
                </span>
              </div>
              <textarea
                value={form.comentario}
                onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
                rows={3}
                maxLength={500}
                placeholder="Cuéntanos cómo fue tu experiencia (opcional)"
                className="mt-3 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-cream-50 outline-none focus:border-gold-500"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-cream-200/50">{form.comentario.length}/500</span>
                <button
                  type="submit"
                  disabled={enviando}
                  className="rounded-full bg-gold-500 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviando ? 'Guardando…' : miResena ? 'Actualizar reseña' : 'Publicar reseña'}
                </button>
              </div>

              {aviso && (
                <p
                  className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                    avisoError
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {aviso}
                </p>
              )}
            </form>
          ) : (
            <p className="mt-4 rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-cream-200/70">
              {usuario ? (
                'Inicia sesión con tu cuenta de cliente para dejar una reseña.'
              ) : (
                <>
                  <Link
                    to="/login"
                    state={{ desde: '/' }}
                    className="font-semibold text-gold-300 hover:underline"
                  >
                    Inicia sesión
                  </Link>{' '}
                  para dejar tu reseña.
                </>
              )}
            </p>
          )}

          {/* Lista de reseñas */}
          <div className="mt-5 space-y-3">
            {cargando && <p className="text-sm text-cream-200/60">Cargando reseñas…</p>}
            {!cargando && resenas.length === 0 && (
              <p className="text-sm text-cream-200/60">
                Todavía no hay reseñas. ¡Sé el primero en opinar!
              </p>
            )}
            {resenas.map((r) => (
              <article
                key={r.resenaID}
                className="rounded-xl border border-white/10 bg-ink-800/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-cream-50">
                    {capitalizar(r.nombre)} {capitalizar(r.apellido)}
                  </span>
                  <Estrellas valor={r.calificacion} className="text-sm" />
                </div>
                {r.comentario && (
                  <p className="mt-2 text-sm text-cream-200/75">{r.comentario}</p>
                )}
                <p className="mt-2 text-xs text-cream-200/40">{fechaHora(r.fecha_creacion)}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
