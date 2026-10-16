import { useEffect, useState } from 'react'
import { getBarberos, crearBarbero } from '../../api/barberos'
import { getUsuarios } from '../../api/usuarios'
import { mensajeDeError } from '../../api/client'
import { inputClase, botonPrimario, etiqueta, tarjeta } from '../../ui/estilos'

export default function AdminBarberos() {
  const [barberos, setBarberos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState({ usuarioID: '', comision: '20', estado: true })
  const [enviando, setEnviando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let activo = true
    Promise.all([getBarberos(), getUsuarios()])
      .then(([b, u]) => {
        if (!activo) return
        setBarberos(b)
        setUsuarios(u)
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [recarga])

  // Un usuario solo puede ser barbero una vez: se ofrecen los que aún no lo son.
  const yaSonBarbero = new Set(barberos.map((b) => b.usuarioID))
  const candidatos = usuarios.filter((u) => !yaSonBarbero.has(u.usuarioID))

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    if (!form.usuarioID) {
      setAviso('Selecciona un usuario.')
      return
    }
    setEnviando(true)
    try {
      await crearBarbero({
        usuarioID: Number(form.usuarioID),
        comision: Number(form.comision),
        estado: form.estado,
      })
      setForm({ usuarioID: '', comision: '20', estado: true })
      setRecarga((n) => n + 1)
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <p className="mb-3 text-xs text-cream-200/50">
          La API no permite editar comisión ni desactivar un barbero: eso se hace en
          la base de datos.
        </p>
        {cargando && <p className="text-cream-200/70">Cargando barberos…</p>}
        {error && <p className="text-red-400">{error}</p>}
        <div className="space-y-2">
          {barberos.map((b) => (
            <div
              key={b.barberoID}
              className={`${tarjeta} flex flex-wrap items-center gap-3 px-4 py-3`}
            >
              <div className="min-w-[12rem]">
                <p className="text-sm font-semibold text-cream-50">
                  {b.nombre} {b.apellido}
                </p>
                <p className="text-xs text-cream-200/50">{b.correo}</p>
              </div>
              <span className="text-xs text-cream-200/60">Comisión {b.comision}%</span>
              <span
                className={`rounded-full px-3 py-1 text-xs uppercase tracking-wider ${
                  b.estado
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-white/10 text-cream-200/60'
                }`}
              >
                {b.estado ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={enviar} className="h-fit rounded-xl border border-white/10 bg-ink-900 p-5">
        <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
          Nuevo barbero
        </h2>
        <label className={`mt-4 ${etiqueta}`}>
          Usuario
          <select
            value={form.usuarioID}
            onChange={(e) => setForm((f) => ({ ...f, usuarioID: e.target.value }))}
            className={`mt-2 ${inputClase}`}
          >
            <option value="">Selecciona…</option>
            {candidatos.map((u) => (
              <option key={u.usuarioID} value={u.usuarioID}>
                {u.nombre} {u.apellido} · {u.correo}
              </option>
            ))}
          </select>
        </label>
        <label className={`mt-3 ${etiqueta}`}>
          Comisión (%)
          <input
            type="number"
            min="0"
            max="999.99"
            step="0.01"
            value={form.comision}
            onChange={(e) => setForm((f) => ({ ...f, comision: e.target.value }))}
            className={`mt-2 ${inputClase}`}
          />
        </label>
        <label className="mt-4 flex items-center gap-3 text-sm text-cream-200">
          <input
            type="checkbox"
            checked={form.estado}
            onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
            className="h-4 w-4 accent-gold-500"
          />
          Activo
        </label>
        {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}
        <button type="submit" disabled={enviando} className={`mt-5 w-full ${botonPrimario}`}>
          Crear barbero
        </button>
      </form>
    </div>
  )
}
