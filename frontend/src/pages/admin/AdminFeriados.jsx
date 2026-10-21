import { useEffect, useState } from 'react'
import { getFeriados, crearFeriado, eliminarFeriado } from '../../api/feriados'
import { mensajeDeError } from '../../api/client'
import { inputClase, botonPrimario, etiqueta, tarjeta } from '../../ui/estilos'
import { formatearFechaLarga } from '../../utils/formato'

const TIPOS = [
  { valor: 'festivo', texto: 'Festivo' },
  { valor: 'religioso', texto: 'Religioso' },
  { valor: 'carnaval', texto: 'Carnaval' },
]

const VACIO = { fecha: '', nombre: '', tipo: 'festivo' }

export default function AdminFeriados() {
  const [feriados, setFeriados] = useState([])
  const [diasDescanso, setDiasDescanso] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [borrando, setBorrando] = useState(null)

  useEffect(() => {
    let activo = true
    getFeriados()
      .then((data) => {
        if (!activo) return
        setFeriados(data.feriados)
        setDiasDescanso(data.diasDescanso)
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  function cambio(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    setEnviando(true)
    try {
      await crearFeriado({ fecha: form.fecha, nombre: form.nombre, tipo: form.tipo })
      setFeriados((prev) =>
        [...prev, { fecha: form.fecha, nombre: form.nombre, tipo: form.tipo }].sort((a, b) =>
          a.fecha.localeCompare(b.fecha),
        ),
      )
      setForm(VACIO)
      setAviso('Día no laborable registrado.')
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(feriado) {
    if (!window.confirm(`¿Quitar "${feriado.nombre}" (${feriado.fecha})?`)) return
    setAviso(null)
    setBorrando(feriado.fecha)
    try {
      await eliminarFeriado(feriado.fecha)
      setFeriados((prev) => prev.filter((f) => f.fecha !== feriado.fecha))
      setAviso('Día no laborable eliminado.')
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setBorrando(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <p className="mb-3 text-xs text-cream-200/50">
          En estos días no se puede reservar. El servidor los rechaza aunque se llame a la
          API directamente.
        </p>
        {cargando && <p className="text-cream-200/70">Cargando días no laborables…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {diasDescanso.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-cream-200/50">
              Descanso semanal:
            </span>
            {diasDescanso.map((d) => (
              <span
                key={d}
                className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize tracking-wider text-cream-200"
              >
                {d}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {feriados.map((f) => (
            <div key={f.fecha} className={`${tarjeta} flex flex-wrap items-center gap-3 px-4 py-3`}>
              <div className="min-w-[12rem]">
                <p className="text-sm font-semibold text-cream-50">{f.nombre}</p>
                <p className="text-xs text-cream-200/50">
                  {formatearFechaLarga(f.fecha)} · {f.fecha}
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-cream-200">
                {f.tipo}
              </span>
              <button
                type="button"
                disabled={borrando === f.fecha}
                onClick={() => borrar(f)}
                className="ml-auto text-xs uppercase tracking-wider text-red-300 transition hover:text-red-200 disabled:opacity-50"
              >
                {borrando === f.fecha ? 'Quitando…' : 'Quitar'}
              </button>
            </div>
          ))}
          {!cargando && feriados.length === 0 && (
            <p className="text-cream-200/60">No hay días no laborables registrados.</p>
          )}
        </div>
      </div>

      <form onSubmit={enviar} className="h-fit rounded-xl border border-white/10 bg-ink-900 p-5">
        <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
          Nuevo día no laborable
        </h2>

        <label className={`mt-4 ${etiqueta}`}>
          Fecha
          <input
            type="date"
            name="fecha"
            required
            value={form.fecha}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
          />
        </label>

        <label className={`mt-3 ${etiqueta}`}>
          Nombre
          <input
            name="nombre"
            required
            value={form.nombre}
            onChange={cambio}
            placeholder="Año Nuevo"
            className={`mt-2 ${inputClase}`}
          />
        </label>

        <label className={`mt-3 ${etiqueta}`}>
          Tipo
          <select name="tipo" value={form.tipo} onChange={cambio} className={`mt-2 ${inputClase}`}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </select>
        </label>

        {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}

        <button type="submit" disabled={enviando} className={`mt-5 w-full ${botonPrimario}`}>
          {enviando ? 'Guardando…' : 'Registrar'}
        </button>
      </form>
    </div>
  )
}
