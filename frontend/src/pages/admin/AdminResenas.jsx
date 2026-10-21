import { useEffect, useState } from 'react'
import { getTodasResenas, eliminarResena, getBarberos, crearResenaBarbero } from '../../api/barberos'
import { getUsuarios } from '../../api/usuarios'
import { mensajeDeError } from '../../api/client'
import { fechaHora } from '../../utils/formato'
import { Estrellas } from '../../components/Estrellas'
import { inputClase, botonPrimario, etiqueta, tarjeta } from '../../ui/estilos'

export default function AdminResenas() {
  const [resenas, setResenas] = useState([])
  const [barberos, setBarberos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [recarga, setRecarga] = useState(0)

  const [form, setForm] = useState({ barberoID: '', autorID: '', calificacion: '5', comentario: '' })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([getTodasResenas(), getBarberos(), getUsuarios()])
      .then(([r, b, u]) => {
        if (!activo) return
        setResenas(r)
        setBarberos(b)
        setUsuarios(u)
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [recarga])

  function cambio(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    if (!form.barberoID || !form.autorID) {
      setAviso('Elige barbero y cliente.')
      return
    }
    setEnviando(true)
    try {
      await crearResenaBarbero(form.barberoID, {
        calificacion: Number(form.calificacion),
        comentario: form.comentario,
        autorID: Number(form.autorID),
      })
      setForm((f) => ({ ...f, comentario: '' }))
      setRecarga((n) => n + 1)
      setAviso('Reseña registrada.')
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(r) {
    const quien = `${r.autor_nombre} ${r.autor_apellido}`.trim()
    if (!window.confirm(`¿Eliminar la reseña de ${quien} sobre ${r.barbero_nombre}?`)) return
    setAviso(null)
    try {
      await eliminarResena(r.resenaID)
      setAviso('Reseña eliminada.')
      setRecarga((n) => n + 1)
    } catch (err) {
      setAviso(mensajeDeError(err))
    }
  }

  const clientes = usuarios.filter((u) => u.rol === 'cliente')

  if (cargando) return <p className="text-cream-200/70">Cargando reseñas…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
            Reseñas ({resenas.length})
          </h2>
          {aviso && <span className="text-sm text-amber-200">{aviso}</span>}
        </div>

        <div className="mt-4 space-y-3">
          {resenas.map((r) => (
            <div key={r.resenaID} className={`${tarjeta} p-4`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Estrellas valor={r.calificacion} />
                <span className="text-sm font-semibold text-cream-50">
                  {r.autor_nombre} {r.autor_apellido}
                </span>
                <span className="text-xs text-cream-200/50">
                  sobre {r.barbero_nombre} {r.barbero_apellido}
                </span>
                <span className="text-xs text-cream-200/40">{fechaHora(r.fecha_creacion)}</span>
                <button
                  type="button"
                  onClick={() => borrar(r)}
                  className="ml-auto text-xs uppercase tracking-wider text-red-300 hover:text-red-200"
                >
                  Eliminar
                </button>
              </div>
              {r.comentario ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-cream-200/80">{r.comentario}</p>
              ) : (
                <p className="mt-2 text-sm italic text-cream-200/40">Sin comentario.</p>
              )}
            </div>
          ))}
          {resenas.length === 0 && <p className="text-cream-200/60">Todavía no hay reseñas.</p>}
        </div>
      </div>

      <form onSubmit={enviar} className="h-fit rounded-xl border border-white/10 bg-ink-900 p-5">
        <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
          Registrar reseña
        </h2>
        <p className="mt-2 text-xs text-cream-200/60">
          El administrador puede dejar la reseña en nombre de un cliente (por ejemplo, si la dejó
          por teléfono).
        </p>

        <label className={`mt-4 ${etiqueta}`}>
          Barbero
          <select name="barberoID" required value={form.barberoID} onChange={cambio} className={`mt-2 ${inputClase}`}>
            <option value="">Selecciona…</option>
            {barberos.map((b) => (
              <option key={b.barberoID} value={b.barberoID}>
                {b.nombre} {b.apellido}
              </option>
            ))}
          </select>
        </label>

        <label className={`mt-3 ${etiqueta}`}>
          Cliente
          <select name="autorID" required value={form.autorID} onChange={cambio} className={`mt-2 ${inputClase}`}>
            <option value="">Selecciona…</option>
            {clientes.map((u) => (
              <option key={u.usuarioID} value={u.usuarioID}>
                {u.nombre} {u.apellido} · {u.correo}
              </option>
            ))}
          </select>
        </label>

        <label className={`mt-3 ${etiqueta}`}>
          Calificación
          <select name="calificacion" value={form.calificacion} onChange={cambio} className={`mt-2 ${inputClase}`}>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {'★'.repeat(n)} ({n})
              </option>
            ))}
          </select>
        </label>

        <label className={`mt-3 ${etiqueta}`}>
          Comentario
          <textarea
            name="comentario"
            rows="3"
            value={form.comentario}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
          />
        </label>

        {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}

        <button type="submit" disabled={enviando} className={`mt-5 w-full ${botonPrimario}`}>
          {enviando ? 'Guardando…' : 'Registrar reseña'}
        </button>
      </form>
    </div>
  )
}
