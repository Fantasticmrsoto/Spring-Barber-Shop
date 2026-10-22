import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCitaPublica, cancelarCitaPublica } from '../api/citas'
import { mensajeDeError } from '../api/client'
import { fechaHora, precio, duracion, nombreCliente } from '../utils/formato'
import { ESTADOS_CITA, mensajeDenegacion } from '../utils/pago'
import { enlaceWhatsApp } from '../config'
import AppHeader from '../components/AppHeader'
import EstadoPagoBadge from '../components/EstadoPagoBadge'

const ESTADOS = ESTADOS_CITA

const CANCELABLES = ['pendiente', 'confirmada']

export default function CitaPublica() {
  const { codigo } = useParams()
  const [cita, setCita] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    let activo = true
    getCitaPublica(codigo)
      .then((c) => activo && setCita(c))
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [codigo])

  async function cancelar() {
    setError(null)
    setCancelando(true)
    try {
      const actualizada = await cancelarCitaPublica(codigo)
      setCita(actualizada)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCancelando(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <AppHeader />
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-5 sm:py-14">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
          Mi cita
        </h1>

        {cargando && <p className="mt-6 text-cream-200/70">Cargando…</p>}
        {error && !cita && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
            {error}
          </p>
        )}

        {cita && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-ink-900 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-lg uppercase tracking-wide text-cream-50">
                {cita.servicio_nombre}
              </span>
              <EstadoPagoBadge estado={cita.pago_estado} metodo={cita.pago_metodo} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider ${
                  (ESTADOS[cita.estado] ?? ESTADOS.pendiente).clase
                }`}
              >
                {(ESTADOS[cita.estado] ?? ESTADOS.pendiente).label}
              </span>
            </div>

            {cita.pago_estado === 'rechazado' && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {mensajeDenegacion(cita)}
              </p>
            )}

            {cita.pago_estado === 'pendiente' && cita.pago_metodo === 'pago_movil' && (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Enviamos tu comprobante de pago móvil. El administrador lo revisa y tu
                cita queda confirmada en cuanto lo aprueba.
              </p>
            )}

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-cream-200/60">Fecha</dt>
                <dd className="text-right text-cream-50">{fechaHora(cita.fecha_inicio)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cream-200/60">Duración</dt>
                <dd className="text-right text-cream-50">{duracion(cita.duracion_minutos)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cream-200/60">Barbero</dt>
                <dd className="text-right text-cream-50">
                  {cita.barbero_nombre} {cita.barbero_apellido}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cream-200/60">Precio</dt>
                <dd className="text-right text-cream-50">{precio(cita.precio)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cream-200/60">A nombre de</dt>
                <dd className="text-right text-cream-50">{nombreCliente(cita)}</dd>
              </div>
            </dl>

            {error && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {CANCELABLES.includes(cita.estado) && (
                <button
                  type="button"
                  disabled={cancelando}
                  onClick={cancelar}
                  className="w-full rounded-full border border-red-400/40 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-red-300 transition hover:bg-red-500/15 disabled:opacity-50 sm:w-auto"
                >
                  {cancelando ? 'Cancelando…' : 'Cancelar cita'}
                </button>
              )}
              <a
                href={enlaceWhatsApp(
                  `Hola, tengo una cita (${cita.servicio_nombre}) el ${fechaHora(cita.fecha_inicio)}.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-full border border-emerald-400/40 px-6 py-3 text-center text-sm font-semibold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/15 sm:w-auto"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-cream-200/60">
          {cita?.es_invitado
            ? 'Crea una cuenta con tu teléfono y esta cita aparecerá en “Mis citas”. '
            : '¿Quieres gestionar todas tus citas? '}
          <Link
            to="/registro"
            state={{ telefono: cita?.cliente_telefono ?? '' }}
            className="font-semibold text-gold-400 hover:underline"
          >
            {cita?.es_invitado ? 'Crear cuenta' : 'Crea una cuenta'}
          </Link>
        </p>
      </div>
    </div>
  )
}
