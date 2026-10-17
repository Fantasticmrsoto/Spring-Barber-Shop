import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getServicios } from '../api/servicios'
import { getBarberos } from '../api/barberos'
import { getServiciosDeBarbero } from '../api/barberoServicios'
import { getHorariosDeBarbero } from '../api/horarios'
import { getOcupados, crearCita, crearCitaPublica, reprogramarCita } from '../api/citas'
import { mensajeDeError } from '../api/client'
import { precio, duracion, urlImagen } from '../utils/formato'
import { enlaceWhatsApp } from '../config'
import AppHeader from '../components/AppHeader'

const PASO_SERVICIO = 'Servicio'
const PASO_BARBERO = 'Barbero'
const PASO_FECHA = 'Fecha y hora'
const PASO_DATOS = 'Tus datos'

const paraMinutos = (hhmm) => {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

const aHHMM = (min) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function generarSlots(inicio, fin, duracionMinutos) {
  const slots = []
  const desde = paraMinutos(inicio)
  const hasta = paraMinutos(fin)
  for (let t = desde; t + duracionMinutos <= hasta; t += 30) {
    slots.push(aHHMM(t))
  }
  return slots
}

const iniciales = (nombre = '', apellido = '') =>
  `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()

export default function Reservar() {
  const { usuario } = useAuth()
  const [searchParams] = useSearchParams()

  // Sin sesión se reserva como invitado: se pide nombre y teléfono al final.
  const esInvitado = !usuario

  // Parámetros de entrada:
  //  - ?barbero=ID  -> barbero fijo: se omite el paso de elegir barbero.
  //  - ?servicio=ID -> servicio fijo: se omite el paso de elegir servicio (se usa
  //                    para "repetir" o "reprogramar" una cita concreta).
  //  - ?reprogramar=citaID -> no crea una cita nueva, actualiza la fecha/hora.
  const barberoFijoID = Number(searchParams.get('barbero')) || null
  const servicioFijoID = Number(searchParams.get('servicio')) || null
  const reprogramarID = Number(searchParams.get('reprogramar')) || null
  const esBarberoFijo = Boolean(barberoFijoID)
  const esServicioFijo = Boolean(servicioFijoID)
  const esReprogramar = Boolean(reprogramarID)

  const pasos = []
  if (!esServicioFijo) pasos.push(PASO_SERVICIO)
  if (!esBarberoFijo) pasos.push(PASO_BARBERO)
  pasos.push(PASO_FECHA)
  if (esInvitado) pasos.push(PASO_DATOS)

  const [servicios, setServicios] = useState([])
  const [barberos, setBarberos] = useState([])
  const [cargandoBase, setCargandoBase] = useState(true)
  const [errorBase, setErrorBase] = useState(null)
  const [idsDelBarberoFijo, setIdsDelBarberoFijo] = useState(null)

  const [paso, setPaso] = useState(0)
  const [servicio, setServicio] = useState(null)
  const [barbero, setBarbero] = useState(null)
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')

  // barberos -> ids de servicios que ofrecen
  const [ofertas, setOfertas] = useState(null)
  const [horarios, setHorarios] = useState(null)
  const [citasBarbero, setCitasBarbero] = useState([])

  const [ahora, setAhora] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmada, setConfirmada] = useState(null)
  const [codigoGestion, setCodigoGestion] = useState(null)
  const [datosInvitado, setDatosInvitado] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
  })

  const pasoActual = pasos[paso]

  useEffect(() => {
    let activo = true
    Promise.all([getServicios(), getBarberos()])
      .then(([s, b]) => {
        if (!activo) return
        setServicios(s)
        setBarberos(b)
        setAhora(new Date())
        if (barberoFijoID) {
          const elegido = b.find((x) => x.barberoID === barberoFijoID)
          if (elegido) setBarbero(elegido)
          else setErrorBase('El barbero seleccionado no está disponible.')
        }
        if (servicioFijoID) {
          const elegido = s.find((x) => x.serviciosID === servicioFijoID)
          if (elegido) setServicio(elegido)
          else setErrorBase('El servicio seleccionado ya no está disponible.')
        }
      })
      .catch((err) => activo && setErrorBase(mensajeDeError(err)))
      .finally(() => activo && setCargandoBase(false))
    return () => {
      activo = false
    }
  }, [barberoFijoID, servicioFijoID])

  // Con barbero fijo, se limita el catálogo a los servicios que ofrece.
  useEffect(() => {
    if (!barberoFijoID) return
    let activo = true
    getServiciosDeBarbero(barberoFijoID)
      .then((suyos) => {
        if (activo) setIdsDelBarberoFijo(new Set(suyos.map((s) => s.serviciosID)))
      })
      .catch(() => activo && setIdsDelBarberoFijo(new Set()))
    return () => {
      activo = false
    }
  }, [barberoFijoID])

  // Al elegir servicio, se averigua qué barberos lo ofrecen. Solo en el flujo
  // normal: con barbero fijo el paso de barberos no existe.
  useEffect(() => {
    if (!servicio || esBarberoFijo) return
    let activo = true
    Promise.all(
      barberos.map(async (b) => {
        const suyos = await getServiciosDeBarbero(b.barberoID).catch(() => [])
        return [b.barberoID, suyos.map((s) => s.serviciosID)]
      }),
    ).then((pares) => {
      if (activo) setOfertas(new Map(pares))
    })
    return () => {
      activo = false
    }
  }, [servicio, barberos, esBarberoFijo])

  // Al elegir barbero, se cargan su horario y sus horas ocupadas para calcular cupos.
  useEffect(() => {
    if (!barbero) return
    let activo = true
    Promise.all([
      getHorariosDeBarbero(barbero.barberoID),
      getOcupados(barbero.barberoID, { excluir: reprogramarID }).catch(() => []),
    ]).then(([h, ocupados]) => {
      if (!activo) return
      setHorarios(h)
      setCitasBarbero(ocupados)
    })
    return () => {
      activo = false
    }
  }, [barbero, reprogramarID])

  const barberosDisponibles = useMemo(() => {
    if (!servicio || !ofertas) return []
    return barberos.filter(
      (b) => b.estado && ofertas.get(b.barberoID)?.includes(servicio.serviciosID),
    )
  }, [servicio, ofertas, barberos])

  // Servicios a mostrar en el primer paso: todos, o solo los del barbero fijo.
  const serviciosDisponibles = useMemo(() => {
    if (!esBarberoFijo) return servicios
    if (idsDelBarberoFijo === null) return []
    return servicios.filter((s) => idsDelBarberoFijo.has(s.serviciosID))
  }, [servicios, esBarberoFijo, idsDelBarberoFijo])

  const horarioDelDia = useMemo(() => {
    if (!fecha || !horarios) return null
    const dia = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][
      new Date(`${fecha}T00:00:00`).getDay()
    ]
    return horarios.find((h) => h.dia_semana === dia) || null
  }, [fecha, horarios])

  const ocupados = useMemo(() => {
    if (!fecha) return new Set()
    const set = new Set()
    for (const c of citasBarbero) {
      if (c.estado === 'cancelada') continue
      const d = new Date(c.fecha_inicio)
      if (ymd(d) === fecha) set.add(hm(d))
    }
    return set
  }, [fecha, citasBarbero])

  const slots = useMemo(() => {
    if (!horarioDelDia || !servicio) return []
    return generarSlots(horarioDelDia.hora_inicio, horarioDelDia.hora_fin, servicio.duracion_minutos)
  }, [horarioDelDia, servicio])

  const esHoy = fecha && ahora && ymd(ahora) === fecha

  function elegirServicio(s) {
    setServicio(s)
    setOfertas(null)
    setFecha('')
    setHora('')
    if (!esBarberoFijo) setBarbero(null)
    setPaso(paso + 1)
  }

  function elegirBarbero(b) {
    setBarbero(b)
    setHorarios(null)
    setFecha('')
    setHora('')
    setPaso(paso + 1)
  }

  async function confirmar() {
    setError(null)

    if (esInvitado) {
      const telDigitos = datosInvitado.telefono.replace(/\D/g, '')
      if (
        !datosInvitado.nombre.trim() ||
        !datosInvitado.apellido.trim() ||
        telDigitos.length < 7
      ) {
        setError('Escribe tu nombre, apellido y un teléfono válido (mínimo 7 dígitos).')
        return
      }
    }

    setEnviando(true)
    try {
      const fecha_hora = `${fecha}T${hora}:00`

      if (esReprogramar) {
        const cita = await reprogramarCita(reprogramarID, { fecha_hora })
        setConfirmada(cita)
      } else if (esInvitado) {
        const { cita, codigo } = await crearCitaPublica({
          barberoID: barbero.barberoID,
          servicioID: servicio.serviciosID,
          fecha_hora,
          nombre: datosInvitado.nombre.trim(),
          apellido: datosInvitado.apellido.trim(),
          telefono: datosInvitado.telefono.trim(),
        })
        setCodigoGestion(codigo)
        setConfirmada(cita)
      } else {
        const cita = await crearCita({
          clienteID: usuario.usuarioID,
          barberoID: barbero.barberoID,
          servicioID: servicio.serviciosID,
          fecha_hora,
        })
        setConfirmada(cita)
      }
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  function reiniciar() {
    setConfirmada(null)
    setCodigoGestion(null)
    if (!esServicioFijo) setServicio(null)
    if (!esBarberoFijo) setBarbero(null)
    setFecha('')
    setHora('')
    setPaso(0)
    setError(null)
    setDatosInvitado({ nombre: '', apellido: '', telefono: '' })
  }

  if (confirmada) {
    const fechaLegible = new Date(`${fecha}T${hora}:00`).toLocaleString('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
    })
    const mensajeWhatsApp = [
      'Hola, quiero confirmar esta cita:',
      `• Servicio: ${servicio.nombre}`,
      `• Barbero: ${barbero.nombre} ${barbero.apellido}`,
      `• Fecha: ${fechaLegible}`,
      esInvitado
        ? `• A nombre de: ${datosInvitado.nombre} ${datosInvitado.apellido} (${datosInvitado.telefono})`
        : '',
      codigoGestion ? `• Enlace de mi cita: ${window.location.origin}/cita/${codigoGestion}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    return (
      <div className="min-h-screen bg-ink-950">
        <AppHeader />
        <div className="mx-auto max-w-lg px-5 py-16 text-center">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-emerald-300">
              {esReprogramar ? '¡Cita reprogramada!' : '¡Cita agendada!'}
            </h1>
            <p className="mt-3 text-cream-200/80">
              {servicio.nombre} con {barbero.nombre} {barbero.apellido}
            </p>
            <p className="mt-1 text-sm text-cream-200/70">{fechaLegible}</p>
            <p className="mt-4 text-xs uppercase tracking-wider text-cream-200/50">
              Estado: {confirmada.estado}
            </p>

            {codigoGestion && (
              <div className="mt-5 rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-left">
                <p className="text-xs uppercase tracking-wider text-cream-200/60">
                  Guarda este enlace
                </p>
                <Link
                  to={`/cita/${codigoGestion}`}
                  className="mt-1 block break-all text-sm font-semibold text-gold-300 hover:underline"
                >
                  Ver o cancelar mi cita
                </Link>
                <p className="mt-1 text-xs text-cream-200/50">
                  Te permite gestionar la cita sin crear una cuenta.
                </p>
              </div>
            )}
          </div>

          {codigoGestion && (
            <a
              href={enlaceWhatsApp(mensajeWhatsApp)}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/15"
            >
              Enviar la cita por WhatsApp
            </a>
          )}

          {esInvitado && (
            <div className="mt-6 rounded-2xl border border-gold-500/25 bg-gold-500/5 p-5">
              <p className="text-sm text-cream-200/80">
                ¿Quieres ver y gestionar tus citas cuando quieras? Crea una cuenta con
                este mismo teléfono y tus reservas aparecerán en “Mis citas”.
              </p>
              <Link
                to="/registro"
                state={{
                  nombre: datosInvitado.nombre.trim(),
                  apellido: datosInvitado.apellido.trim(),
                  telefono: datosInvitado.telefono.trim(),
                }}
                className="mt-3 inline-block rounded-full bg-gold-500 px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
              >
                Crear mi cuenta
              </Link>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!esInvitado && (
              <Link
                to="/mis-citas"
                className="rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400"
              >
                Ver mis citas
              </Link>
            )}
            {!esReprogramar && (
              <button
                type="button"
                onClick={reiniciar}
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-wider transition hover:border-gold-400"
              >
                Agendar otra
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <AppHeader />
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
          {esReprogramar ? 'Reprogramar cita' : 'Reservar cita'}
        </h1>

        <ol className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-wider">
          {pasos.map((nombre, i) => (
            <li
              key={nombre}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 ${
                i === paso
                  ? 'border-gold-500 text-gold-300'
                  : i < paso
                    ? 'border-white/15 text-cream-200/70'
                    : 'border-white/10 text-cream-200/40'
              }`}
            >
              <span className="font-display">{i + 1}</span>
              {nombre}
            </li>
          ))}
        </ol>

        {(esBarberoFijo || esServicioFijo) && (barbero || servicio) && (
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-gold-500/30 bg-gold-500/5 p-4">
            {barbero &&
              (barbero.foto_url ? (
                <img
                  src={urlImagen(barbero.foto_url)}
                  alt={`${barbero.nombre} ${barbero.apellido}`}
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-gold-500/50"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-500 to-gold-700 font-display font-bold text-ink-950">
                  {iniciales(barbero.nombre, barbero.apellido)}
                </span>
              ))}
            <div>
              {barbero && (
                <>
                  <p className="text-xs uppercase tracking-wider text-gold-400">
                    {esReprogramar ? 'Reprogramando tu cita con' : 'Estás reservando con'}
                  </p>
                  <p className="font-display text-lg uppercase tracking-wide">
                    {barbero.nombre} {barbero.apellido}
                  </p>
                </>
              )}
              {servicio && (
                <p className="text-xs uppercase tracking-wider text-cream-200/60">
                  {servicio.nombre} · {precio(servicio.precio)} · {duracion(servicio.duracion_minutos)}
                </p>
              )}
            </div>
          </div>
        )}

        {errorBase && <p className="mt-6 text-red-400">{errorBase}</p>}
        {cargandoBase && <p className="mt-6 text-cream-200/70">Cargando catálogo…</p>}

        {!cargandoBase && !errorBase && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-ink-900 p-6">
            {pasoActual === PASO_SERVICIO && (
              <>
                <h2 className="mb-4 font-display text-lg uppercase tracking-wide">
                  Elige un servicio
                </h2>
                {esBarberoFijo && (
                  <p className="mb-4 text-sm text-cream-200/60">
                    Servicios que ofrece {barbero ? `${barbero.nombre} ${barbero.apellido}` : 'el barbero'}.
                  </p>
                )}
                {serviciosDisponibles.length === 0 ? (
                  <p className="text-cream-200/70">
                    {esBarberoFijo
                      ? 'Este barbero todavía no tiene servicios asignados.'
                      : 'No hay servicios disponibles.'}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {serviciosDisponibles.map((s) => (
                      <button
                        key={s.serviciosID}
                        type="button"
                        onClick={() => elegirServicio(s)}
                        className="rounded-xl border border-white/10 bg-ink-800 p-4 text-left transition hover:border-gold-500/60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-cream-50">{s.nombre}</span>
                          <span className="text-sm font-semibold text-gold-300">
                            {precio(s.precio)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-cream-200/60">
                          {duracion(s.duracion_minutos)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {pasoActual === PASO_BARBERO && (
              <>
                <h2 className="mb-4 font-display text-lg uppercase tracking-wide">
                  Elige un barbero
                </h2>
                {ofertas === null ? (
                  <p className="text-cream-200/70">Buscando barberos disponibles…</p>
                ) : barberosDisponibles.length === 0 ? (
                  <p className="text-cream-200/70">
                    Ningún barbero tiene asignado ese servicio todavía.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {barberosDisponibles.map((b) => (
                      <button
                        key={b.barberoID}
                        type="button"
                        onClick={() => elegirBarbero(b)}
                        className="flex items-center gap-4 rounded-xl border border-white/10 bg-ink-800 p-4 text-left transition hover:border-gold-500/60"
                      >
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-gold-500 to-gold-700 font-display font-bold text-ink-950">
                          {b.nombre.charAt(0)}
                          {b.apellido.charAt(0)}
                        </span>
                        <span className="font-semibold text-cream-50">
                          {b.nombre} {b.apellido}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPaso(paso - 1)}
                  className="mt-5 text-sm text-cream-200/60 hover:text-gold-400"
                >
                  ← Volver a servicios
                </button>
              </>
            )}

            {pasoActual === PASO_FECHA && (
              <>
                <h2 className="mb-4 font-display text-lg uppercase tracking-wide">
                  Elige fecha y hora
                </h2>
                <p className="mb-4 text-sm text-cream-200/60">
                  {servicio.nombre} · {barbero.nombre} {barbero.apellido}
                </p>

                <label className="block text-xs uppercase tracking-wider text-cream-200/70">
                  Fecha
                  <input
                    type="date"
                    value={fecha}
                    min={ahora ? ymd(ahora) : undefined}
                    onChange={(e) => {
                      setFecha(e.target.value)
                      setHora('')
                    }}
                    className="mt-2 block w-full max-w-xs rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-cream-50 outline-none focus:border-gold-500"
                  />
                </label>

                {fecha && horarios && !horarioDelDia && (
                  <p className="mt-5 text-amber-300">
                    El barbero no atiende ese día. Prueba con otra fecha.
                  </p>
                )}

                {horarioDelDia && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-wider text-cream-200/60">
                      Horario del día: {horarioDelDia.hora_inicio.slice(0, 5)} –{' '}
                      {horarioDelDia.hora_fin.slice(0, 5)}
                    </p>
                    {slots.length === 0 ? (
                      <p className="mt-3 text-cream-200/60">
                        No hay cupos que quepan en el horario.
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {slots.map((s) => {
                          const pasado = esHoy && s <= hm(ahora)
                          const ocupado = ocupados.has(s)
                          const deshabilitado = pasado || ocupado
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={deshabilitado}
                              onClick={() => setHora(s)}
                              className={`rounded-lg border px-4 py-2 text-sm transition ${
                                hora === s
                                  ? 'border-gold-500 bg-gold-500 text-ink-950'
                                  : deshabilitado
                                    ? 'cursor-not-allowed border-white/5 text-cream-200/25 line-through'
                                    : 'border-white/15 text-cream-100 hover:border-gold-400'
                              }`}
                            >
                              {s}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setPaso(paso - 1)}
                    className="text-sm text-cream-200/60 hover:text-gold-400"
                  >
                    {esBarberoFijo ? '← Volver a servicios' : '← Volver a barberos'}
                  </button>
                  <button
                    type="button"
                    disabled={!fecha || !hora || enviando}
                    onClick={() => (esInvitado ? setPaso(paso + 1) : confirmar())}
                    className="ml-auto rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {esInvitado ? 'Continuar' : enviando ? 'Agendando…' : 'Confirmar cita'}
                  </button>
                </div>
              </>
            )}

            {pasoActual === PASO_DATOS && (
              <>
                <h2 className="mb-1 font-display text-lg uppercase tracking-wide">
                  Tus datos
                </h2>
                <p className="mb-4 text-sm text-cream-200/60">
                  No necesitas crear una cuenta. Tus datos se envían al barbero por
                  WhatsApp y no se guardan como usuario.
                </p>
                <p className="mb-5 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-cream-200/70">
                  {servicio.nombre} · {barbero.nombre} {barbero.apellido} · {fecha} {hora}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs uppercase tracking-wider text-cream-200/70">
                    Nombre
                    <input
                      type="text"
                      value={datosInvitado.nombre}
                      onChange={(e) =>
                        setDatosInvitado((d) => ({ ...d, nombre: e.target.value }))
                      }
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-cream-50 outline-none focus:border-gold-500"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-cream-200/70">
                    Apellido
                    <input
                      type="text"
                      value={datosInvitado.apellido}
                      onChange={(e) =>
                        setDatosInvitado((d) => ({ ...d, apellido: e.target.value }))
                      }
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-cream-50 outline-none focus:border-gold-500"
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-wider text-cream-200/70 sm:col-span-2">
                    Teléfono
                    <input
                      type="tel"
                      value={datosInvitado.telefono}
                      onChange={(e) =>
                        setDatosInvitado((d) => ({ ...d, telefono: e.target.value }))
                      }
                      placeholder="0412-4370853"
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-cream-50 outline-none focus:border-gold-500"
                    />
                  </label>
                </div>

                {error && (
                  <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {error}
                  </p>
                )}

                <div className="mt-6 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setPaso(paso - 1)
                    }}
                    className="text-sm text-cream-200/60 hover:text-gold-400"
                  >
                    ← Volver a fecha y hora
                  </button>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={confirmar}
                    className="ml-auto rounded-full bg-gold-500 px-7 py-3 text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enviando ? 'Agendando…' : 'Confirmar cita'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
