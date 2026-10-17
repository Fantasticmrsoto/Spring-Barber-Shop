import { useEffect, useState } from 'react'
import { getTodasResenas, eliminarResena } from '../../api/barberos'
import { mensajeDeError } from '../../api/client'
import { fechaHora } from '../../utils/formato'
import { Estrellas } from '../../components/Estrellas'
import { tarjeta } from '../../ui/estilos'

export default function AdminResenas() {
  const [resenas, setResenas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let activo = true
    getTodasResenas()
      .then((r) => activo && setResenas(r))
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [recarga])

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

  if (cargando) return <p className="text-cream-200/70">Cargando reseñas…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return (
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
  )
}
