import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getCitas } from '../api/citas'
import { mensajeDeError } from '../api/client'
import { fechaHora, precio, nombreCliente } from '../utils/formato'
import { ESTADOS_CITA } from '../utils/pago'
import AppHeader from '../components/AppHeader'
import ListaCitas, { AccionesClienteCita } from '../components/ListaCitas'

const ESTADO_LABEL = Object.fromEntries(
  Object.entries(ESTADOS_CITA).map(([estado, { label }]) => [estado, label])
)

export default function MisCitas() {
  const { usuario } = useAuth()
  const [citas, setCitas] = useState([])
  const [ahora, setAhora] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const modo = usuario.rol === 'cliente' ? 'cliente' : 'equipo'

  useEffect(() => {
    let activo = true

    // El backend acota la lista según el rol del token (cliente: solo las suyas;
    // barbero: solo las de su agenda), así que aquí no hace falta filtrar.
    getCitas()
      .then((data) => {
        if (!activo) return
        setCitas(data)
        setAhora(Date.now())
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))

    return () => {
      activo = false
    }
  }, [])

  function actualizar(actualizada) {
    setCitas((prev) =>
      prev.map((c) => (c.citaID === actualizada.citaID ? { ...c, ...actualizada } : c)),
    )
  }

  // La próxima cita futura (pendiente o confirmada) más cercana en el tiempo.
  const proxima = useMemo(() => {
    if (!ahora) return null
    return (
      citas
        .filter(
          (c) =>
            (c.estado === 'pendiente' || c.estado === 'confirmada') &&
            new Date(c.fecha_inicio).getTime() > ahora,
        )
        .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))[0] || null
    )
  }, [citas, ahora])

  return (
    <div className="min-h-screen bg-ink-950">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-5 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
            Mis citas
          </h1>
          <Link
            to="/reservar"
            className="rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
          >
            Nueva cita
          </Link>
        </div>

        {cargando && <p className="text-cream-200/70">Cargando citas…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!cargando && !error && proxima && (
          <div className="mb-6 rounded-2xl border border-gold-500/40 bg-gradient-to-br from-gold-500/10 to-ink-800 p-5">
            <p className="text-xs uppercase tracking-wider text-gold-400">
              Tu próxima cita
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
              <div className="min-w-0 sm:min-w-[10rem]">
                <p className="font-display text-lg uppercase tracking-wide sm:text-xl">
                  {fechaHora(proxima.fecha_inicio)}
                </p>
                <p className="text-sm text-cream-200/70">
                  {proxima.servicio_nombre} · {precio(proxima.precio)}
                </p>
              </div>
              <p className="text-sm text-cream-200/80">
                {modo === 'equipo' ? (
                  <>
                    Cliente: {nombreCliente(proxima)}
                  </>
                ) : (
                  <>
                    Barbero: {proxima.barbero_nombre} {proxima.barbero_apellido}
                  </>
                )}
              </p>
              <span className="w-fit rounded-full bg-gold-500/15 px-3 py-1 text-xs uppercase tracking-wider text-gold-300">
                {ESTADO_LABEL[proxima.estado] ?? proxima.estado}
              </span>
              {modo === 'cliente' && (
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <AccionesClienteCita cita={proxima} onCambio={actualizar} setError={setError} />
                </div>
              )}
            </div>
          </div>
        )}

        {!cargando && !error && (
          <ListaCitas citas={citas} modo={modo} onCambio={actualizar} />
        )}
      </div>
    </div>
  )
}
