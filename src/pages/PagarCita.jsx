import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCitas } from '../api/citas'
import { getTransacciones, crearPago } from '../api/transacciones'
import { mensajeDeError } from '../api/client'
import { fechaHora, precio, urlImagen } from '../utils/formato'
import AppHeader from '../components/AppHeader'
import EstadoPagoBadge from '../components/EstadoPagoBadge'
import { METODOS_PAGO } from '../utils/pago'
import { inputClase, botonPrimario, botonSecundario, etiqueta, tarjeta } from '../ui/estilos'

// El pago del cliente es siempre por Pago Móvil: sube el comprobante y queda
// pendiente hasta que el local lo aprueba. Efectivo/tarjeta los registra el personal.
export default function PagarCita() {
  const { citaID } = useParams()
  const id = Number(citaID)

  const [cita, setCita] = useState(null)
  const [pago, setPago] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [referencia, setReferencia] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null)

  async function cargar() {
    const [citas, pagos] = await Promise.all([getCitas(), getTransacciones()])
    const encontrada = citas.find((c) => c.citaID === id) ?? null
    // El pago vigente de la cita es el más reciente que no esté rechazado.
    const vigente = pagos.find((p) => p.citaID === id && p.estado !== 'rechazado') ?? null
    setCita(encontrada)
    setPago(vigente)
  }

  useEffect(() => {
    let activo = true
    setCargando(true)
    cargar()
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    if (!archivo) {
      setAviso('Adjunta la imagen del comprobante.')
      return
    }
    setEnviando(true)
    try {
      await crearPago({
        citaID: id,
        metodo_pago: 'pago_movil',
        referencia_pago: referencia,
        comprobante: archivo,
      })
      setReferencia('')
      setArchivo(null)
      await cargar()
      setAviso('¡Listo! Tu comprobante quedó en revisión.')
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const puedePagar =
    cita && cita.estado !== 'cancelada' && (!pago || pago.estado === 'rechazado')

  return (
    <div className="min-h-screen bg-ink-950">
      <AppHeader />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-5 sm:py-10">
        <Link to="/mis-citas" className="text-sm text-cream-200/60 hover:text-gold-300">
          ← Volver a mis citas
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
          Pagar cita
        </h1>

        {cargando && <p className="mt-6 text-cream-200/70">Cargando…</p>}
        {error && <p className="mt-6 text-red-400">{error}</p>}

        {!cargando && !error && !cita && (
          <p className="mt-6 text-cream-200/70">
            No encontramos esa cita entre las tuyas. ¿Es de otra cuenta?
          </p>
        )}

        {!cargando && !error && cita && (
          <>
            <div className={`${tarjeta} mt-6 p-5`}>
              <p className="text-xs uppercase tracking-wider text-gold-400">
                {cita.servicio_nombre} · {precio(cita.precio)}
              </p>
              <p className="mt-1 font-display text-xl uppercase tracking-wide">
                {fechaHora(cita.fecha_inicio)}
              </p>
              <p className="text-sm text-cream-200/70">
                Barbero: {cita.barbero_nombre} {cita.barbero_apellido}
              </p>
            </div>

            {pago && (
              <div className={`${tarjeta} mt-4 p-5`}>
                <div className="flex flex-wrap items-center gap-3">
                  <EstadoPagoBadge estado={pago.estado} />
                  <span className="text-sm text-cream-200/70">
                    {METODOS_PAGO[pago.metodo_pago] ?? pago.metodo_pago} · {precio(pago.monto)}
                  </span>
                </div>
                {pago.referencia_pago && (
                  <p className="mt-2 text-xs text-cream-200/50">
                    Referencia: {pago.referencia_pago}
                  </p>
                )}
                {pago.comprobante_url && (
                  <a
                    href={urlImagen(pago.comprobante_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 block w-40"
                  >
                    <img
                      src={urlImagen(pago.comprobante_url)}
                      alt="Comprobante"
                      className="w-40 rounded-lg border border-white/10"
                    />
                  </a>
                )}
                {pago.estado === 'completado' && (
                  <p className="mt-3 text-sm text-emerald-300">
                    Este pago ya fue aprobado. ¡Gracias!
                  </p>
                )}
                {pago.estado === 'pendiente' && (
                  <p className="mt-3 text-sm text-amber-200">
                    Estamos revisando tu comprobante. Te avisaremos al aprobarlo.
                  </p>
                )}
                {pago.estado === 'rechazado' && pago.motivo_rechazo && (
                  <p className="mt-3 text-sm text-red-300">
                    Rechazado: {pago.motivo_rechazo}. Puedes enviarlo de nuevo abajo.
                  </p>
                )}
              </div>
            )}

            {puedePagar && (
              <form onSubmit={enviar} className={`${tarjeta} mt-4 p-5`}>
                <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
                  Pago móvil
                </h2>
                <p className="mt-2 text-xs text-cream-200/60">
                  Realiza la transferencia por Pago Móvil al número del local y sube el
                  comprobante. Quedará en revisión hasta que lo aprobemos.
                </p>

                <label className={`mt-4 ${etiqueta}`}>
                  Número de referencia
                  <input
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ej. 00123456"
                    className={`mt-2 ${inputClase}`}
                  />
                </label>

                <label className={`mt-3 ${etiqueta}`}>
                  Comprobante (JPG, PNG, WEBP o GIF)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                    className={`mt-2 ${inputClase} file:mr-3 file:rounded-full file:border-0 file:bg-gold-500 file:px-3 file:py-1 file:text-xs file:font-semibold file:uppercase file:text-ink-950`}
                  />
                </label>

                {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="submit" disabled={enviando} className={`w-full ${botonPrimario} sm:w-auto`}>
                    {enviando ? 'Enviando…' : 'Enviar comprobante'}
                  </button>
                  <Link to="/mis-citas" className={`${botonSecundario} text-center`}>
                    Cancelar
                  </Link>
                </div>
              </form>
            )}

            {!puedePagar && pago?.estado !== 'completado' && pago?.estado !== 'pendiente' && (
              <p className="mt-4 text-sm text-cream-200/60">
                Esta cita no se puede pagar en línea.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
