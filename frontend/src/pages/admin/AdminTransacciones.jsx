import { useEffect, useMemo, useState } from 'react'
import {
  getTransacciones,
  crearPago,
  aprobarPago,
  rechazarPago,
} from '../../api/transacciones'
import { getCitas, completarPagoCita } from '../../api/citas'
import { mensajeDeError } from '../../api/client'
import { precio, fechaHora, urlImagen } from '../../utils/formato'
import EstadoPagoBadge from '../../components/EstadoPagoBadge'
import { ESTADOS_PAGO, METODOS_PAGO } from '../../utils/pago'
import { inputClase, botonPrimario, botonExito, etiqueta, tarjeta } from '../../ui/estilos'

const FILTROS = ['todas', 'pendiente', 'completado', 'rechazado']

// Métodos que se cobran en el mostrador: no dejan comprobante que revisar, así
// que su pago se apunta a mano cuando el cliente paga.
const METODOS_EN_LOCAL = ['efectivo', 'tarjeta']

export default function AdminTransacciones() {
  const [pagos, setPagos] = useState([])
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [recarga, setRecarga] = useState(0)

  const [filtro, setFiltro] = useState('todas')
  const [metodo, setMetodo] = useState('')
  const [ocupada, setOcupada] = useState(null)
  const [rechazando, setRechazando] = useState(null)
  // Cita del cobro en el local que se está apuntando (ids distintos de los de
  // las transacciones: van en su propio estado para no pisarse).
  const [cobrando, setCobrando] = useState(null)

  const [form, setForm] = useState({ citaID: '', metodo_pago: 'efectivo', monto: '', referencia_pago: '' })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([getTransacciones(), getCitas()])
      .then(([p, c]) => {
        if (!activo) return
        setPagos(p)
        setCitas(c)
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [recarga])

  const visibles = useMemo(() => {
    return pagos.filter((p) => {
      if (filtro !== 'todas' && p.estado !== filtro) return false
      if (metodo && p.metodo_pago !== metodo) return false
      return true
    })
  }, [pagos, filtro, metodo])

  const pendientes = useMemo(() => pagos.filter((p) => p.estado === 'pendiente').length, [pagos])

  /*
   * Cobros que faltan en el local.
   *
   * Cuando el cliente reservó pagando en efectivo o con tarjeta, la cita
   * quedó con el pago "pendiente" y sin comprobante que revisar (esos pagos
   * no dejan fila en el libro de pagos: solo la etiqueta en la cita). Aquí se
   * listan para que el administrador apunte el cobro en cuanto la persona
   * paga: el servicio ya se consumió —el bloque de esa hora ya quedó libre—
   * y lo que falta es pasarlo de "pendiente" a "realizado".
   */
  const cobrosPendientes = useMemo(
    () =>
      citas
        .filter(
          (c) =>
            METODOS_EN_LOCAL.includes(c.pago_metodo) && c.pago_estado === 'pendiente',
        )
        .sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio))),
    [citas],
  )

  function cambio(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  // Al elegir la cita, se precarga el precio del servicio como monto sugerido.
  function elegirCita(e) {
    const citaID = e.target.value
    const cita = citas.find((c) => String(c.citaID) === citaID)
    setForm((f) => ({ ...f, citaID, monto: cita ? String(Number(cita.precio)) : '' }))
  }

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    setEnviando(true)
    try {
      await crearPago({
        citaID: Number(form.citaID),
        metodo_pago: form.metodo_pago,
        referencia_pago: form.referencia_pago,
        monto: form.monto === '' ? undefined : Number(form.monto),
      })
      setForm({ citaID: '', metodo_pago: 'efectivo', monto: '', referencia_pago: '' })
      setRecarga((n) => n + 1)
      setAviso('Pago registrado.')
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  /*
   * Pasar un cobro del local de "pendiente" a "realizado".
   *
   * La persona ya took el servicio y ya pagó: lo que se hace es dejar el
   * registro. El estado de la cita no se toca (el servicio ya se hizo).
   */
  async function marcarRealizado(cita) {
    setAviso(null)
    setCobrando(cita.citaID)
    try {
      const actualizada = await completarPagoCita(cita.citaID)
      setCitas((prev) =>
        prev.map((c) => (c.citaID === actualizada.citaID ? { ...c, ...actualizada } : c)),
      )
      // El cobro entra en el libro de pagos: se recarga la lista.
      setRecarga((n) => n + 1)
      setAviso('Cobro marcado como realizado.')
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setCobrando(null)
    }
  }

  async function resolver(pago, accion, motivo) {
    setAviso(null)
    setOcupada(pago.transaccionID)
    try {
      const actualizado =
        accion === 'aprobar'
          ? await aprobarPago(pago.transaccionID)
          : await rechazarPago(pago.transaccionID, motivo)
      setPagos((prev) =>
        prev.map((p) => (p.transaccionID === actualizado.transaccionID ? actualizado : p)),
      )
      setRechazando(null)
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setOcupada(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  filtro === f
                    ? 'bg-gold-500 text-ink-950'
                    : 'border border-white/15 text-cream-200 hover:border-gold-400'
                }`}
              >
                {f === 'todas' ? 'Todas' : ESTADOS_PAGO[f]?.label ?? f}
              </button>
            ))}
          </div>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="ml-auto rounded-lg border border-white/10 bg-ink-800 px-3 py-1.5 text-xs text-cream-50 outline-none focus:border-gold-500"
          >
            <option value="">Todos los métodos</option>
            {Object.entries(METODOS_PAGO).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>

        {pendientes > 0 && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {pendientes} pago{pendientes === 1 ? '' : 's'} pendiente{pendientes === 1 ? '' : 's'} de revisar.
            <span className="mt-1 block text-xs text-cream-200/60">
              Al <strong className="text-emerald-300">aprobar</strong>, la cita queda confirmada y el
              pago se marca como completado. Al <strong className="text-red-300">rechazar</strong>, la
              cita se deniega y el cliente ve el motivo en “Mis citas”.
            </span>
          </p>
        )}

        {aviso && <p className="mb-3 text-sm text-amber-200">{aviso}</p>}

        {/*
          Cobros del local: citas reservadas con efectivo o tarjeta cuyo pago
          todavía no se ha apuntado. Es el punto donde el administrador pasa el
          cobro de "pendiente" a "realizado".
        */}
        <section className="mb-6 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4">
          <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
            Cobros pendientes en el local
          </h2>
          <p className="mt-1 text-xs text-cream-200/60">
            Citas reservadas con efectivo o tarjeta que ya se consumieron. Cuando el
            cliente paga en el mostrador, márcalo como realizado.
          </p>

          {!cargando && cobrosPendientes.length === 0 ? (
            <p className="mt-3 text-sm text-cream-200/60">
              No hay cobros pendientes en el local.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {cobrosPendientes.map((c) => (
                <div
                  key={c.citaID}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-ink-800 px-4 py-3"
                >
                  <div className="min-w-[11rem]">
                    <p className="text-sm font-semibold text-cream-50">
                      {fechaHora(c.fecha_inicio)}
                    </p>
                    <p className="text-xs text-cream-200/50">
                      {c.servicio_nombre} · {c.cliente_nombre} {c.cliente_apellido}
                    </p>
                    {c.barbero_nombre && (
                      <p className="text-xs text-cream-200/50">
                        {c.barbero_nombre} {c.barbero_apellido}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-cream-200">
                    {METODOS_PAGO[c.pago_metodo] ?? c.pago_metodo}
                  </span>
                  <EstadoPagoBadge estado={c.pago_estado} metodo={c.pago_metodo} />

                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-sm font-semibold text-gold-300">
                      {precio(c.precio)}
                    </span>
                    <button
                      type="button"
                      disabled={cobrando === c.citaID}
                      onClick={() => marcarRealizado(c)}
                      className={botonExito}
                    >
                      {cobrando === c.citaID ? 'Guardando…' : 'Marcar como realizado'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {cargando && <p className="text-cream-200/70">Cargando pagos…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!cargando && !error && visibles.length === 0 && (
          <p className="text-cream-200/60">No hay pagos para mostrar.</p>
        )}

        <div className="space-y-3">
          {visibles.map((p) => (
            <div key={p.transaccionID} className={`${tarjeta} p-4`}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[11rem]">
                  <p className="text-sm font-semibold text-cream-50">
                    {p.cliente_nombre} {p.cliente_apellido}
                    {p.es_invitado && (
                      <span className="ml-2 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-indigo-300">
                        Invitado
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-cream-200/50">
                    {p.fecha_inicio ? fechaHora(p.fecha_inicio) : 'Sin cita'} ·{' '}
                    {p.servicio_nombre ?? '—'}
                  </p>
                  {p.barbero_nombre && (
                    <p className="text-xs text-cream-200/50">
                      {p.barbero_nombre} {p.barbero_apellido}
                    </p>
                  )}
                </div>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-cream-200">
                  {METODOS_PAGO[p.metodo_pago] ?? p.metodo_pago ?? '—'}
                </span>
                <EstadoPagoBadge estado={p.estado} />

                <div className="ml-auto text-right">
                  <p className="text-sm font-semibold text-gold-300">{precio(p.monto)}</p>
                  {p.referencia_pago && (
                    <p className="text-xs text-cream-200/50">Ref: {p.referencia_pago}</p>
                  )}
                  <p className="text-[0.65rem] text-cream-200/40">
                    {fechaHora(p.fecha_creacion)}
                  </p>
                </div>

                {p.comprobante_url && (
                  <a
                    href={urlImagen(p.comprobante_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                    title="Ver comprobante"
                  >
                    <img
                      src={urlImagen(p.comprobante_url)}
                      alt="Comprobante"
                      className="h-14 w-14 rounded-lg border border-white/10 object-cover"
                    />
                  </a>
                )}
              </div>

              {p.motivo_rechazo && (
                <p className="mt-2 text-xs text-red-300">Motivo: {p.motivo_rechazo}</p>
              )}

              {p.estado === 'pendiente' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {rechazando?.id === p.transaccionID ? (
                    <>
                      <input
                        autoFocus
                        placeholder="Motivo del rechazo (opcional)"
                        value={rechazando.motivo}
                        onChange={(e) =>
                          setRechazando((r) => ({ ...r, motivo: e.target.value }))
                        }
                        className={`${inputClase} max-w-xs py-1.5 text-sm`}
                      />
                      <button
                        type="button"
                        disabled={ocupada === p.transaccionID}
                        onClick={() => resolver(p, 'rechazar', rechazando.motivo)}
                        className="rounded-full border border-red-400/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                      >
                        Confirmar rechazo
                      </button>
                      <button
                        type="button"
                        onClick={() => setRechazando(null)}
                        className="text-xs uppercase tracking-wider text-cream-200/60 hover:text-gold-300"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={ocupada === p.transaccionID}
                        onClick={() => resolver(p, 'aprobar')}
                        className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-950 hover:bg-emerald-400 disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={ocupada === p.transaccionID}
                        onClick={() => setRechazando({ id: p.transaccionID, motivo: '' })}
                        className="rounded-full border border-red-400/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={enviar} className="h-fit rounded-xl border border-white/10 bg-ink-900 p-5">
        <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
          Registrar pago en el local
        </h2>
        <p className="mt-2 text-xs text-cream-200/60">
          Efectivo o tarjeta cobrado en el local queda como completado.
        </p>

        <label className={`mt-4 ${etiqueta}`}>
          Cita
          <select
            name="citaID"
            required
            value={form.citaID}
            onChange={elegirCita}
            className={`mt-2 ${inputClase}`}
          >
            <option value="">Selecciona…</option>
            {citas.map((c) => (
              <option key={c.citaID} value={c.citaID}>
                {fechaHora(c.fecha_inicio)} · {c.servicio_nombre} · {c.cliente_nombre}{' '}
                {c.cliente_apellido}
              </option>
            ))}
          </select>
        </label>

        <label className={`mt-3 ${etiqueta}`}>
          Método
          <select
            name="metodo_pago"
            value={form.metodo_pago}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Monto
            <input
              type="number"
              step="0.01"
              min="0"
              name="monto"
              value={form.monto}
              onChange={cambio}
              className={`mt-2 ${inputClase}`}
            />
          </label>
          <label className={etiqueta}>
            Referencia
            <input
              name="referencia_pago"
              value={form.referencia_pago}
              onChange={cambio}
              placeholder="Opcional"
              className={`mt-2 ${inputClase}`}
            />
          </label>
        </div>

        {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}
        <button type="submit" disabled={enviando} className={`mt-5 w-full ${botonPrimario}`}>
          {enviando ? 'Registrando…' : 'Registrar pago'}
        </button>
      </form>
    </div>
  )
}
