import { useEffect, useState } from 'react'
import {
  getServicios,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
} from '../../api/servicios'
import { mensajeDeError } from '../../api/client'
import { precio, duracion } from '../../utils/formato'
import { inputClase, botonPrimario, botonSecundario, etiqueta, tarjeta } from '../../ui/estilos'

const VACIO = { nombre: '', descripcion: '', precio: '', duracion_minutos: '' }

export default function AdminServicios() {
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editandoID, setEditandoID] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [borrando, setBorrando] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let activo = true
    getServicios()
      .then((data) => activo && setServicios(data))
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [recarga])

  function cambio(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  function editar(s) {
    setAviso(null)
    setEditandoID(s.serviciosID)
    setForm({
      nombre: s.nombre,
      descripcion: s.descripcion,
      precio: String(s.precio),
      duracion_minutos: String(s.duracion_minutos),
    })
  }

  function cancelarEdicion() {
    setEditandoID(null)
    setForm(VACIO)
    setAviso(null)
  }

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    setEnviando(true)
    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        precio: Number(form.precio),
        duracion_minutos: Number(form.duracion_minutos),
      }
      if (editandoID) {
        await actualizarServicio(editandoID, payload)
        setAviso('Servicio actualizado.')
      } else {
        await crearServicio(payload)
        setAviso('Servicio creado.')
      }
      cancelarEdicion()
      setRecarga((n) => n + 1)
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(s) {
    if (!window.confirm(`¿Eliminar el servicio "${s.nombre}"? Esta acción no se puede deshacer.`)) {
      return
    }
    setAviso(null)
    setBorrando(s.serviciosID)
    try {
      await eliminarServicio(s.serviciosID)
      if (editandoID === s.serviciosID) cancelarEdicion()
      setRecarga((n) => n + 1)
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setBorrando(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        {cargando && <p className="text-cream-200/70">Cargando servicios…</p>}
        {error && <p className="text-red-400">{error}</p>}
        <div className="space-y-2">
          {servicios.map((s) => (
            <div
              key={s.serviciosID}
              className={`${tarjeta} flex flex-wrap items-center gap-4 px-4 py-3 ${
                editandoID === s.serviciosID ? 'ring-1 ring-gold-500/60' : ''
              }`}
            >
              <div className="min-w-[10rem] flex-1">
                <p className="text-sm font-semibold text-cream-50">{s.nombre}</p>
                <p className="text-xs text-cream-200/50">{s.descripcion}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gold-300">{precio(s.precio)}</p>
                <p className="text-xs text-cream-200/50">{duracion(s.duracion_minutos)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => editar(s)}
                  className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cream-200 transition hover:border-gold-400 hover:text-gold-300"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={borrando === s.serviciosID}
                  onClick={() => borrar(s)}
                  className="rounded-full border border-red-400/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                >
                  {borrando === s.serviciosID ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
          {!cargando && servicios.length === 0 && (
            <p className="text-cream-200/60">No hay servicios registrados.</p>
          )}
        </div>
      </div>

      <form onSubmit={enviar} className="h-fit rounded-xl border border-white/10 bg-ink-900 p-5">
        <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
          {editandoID ? 'Editar servicio' : 'Nuevo servicio'}
        </h2>
        <label className={`mt-4 ${etiqueta}`}>
          Nombre
          <input name="nombre" required value={form.nombre} onChange={cambio} className={`mt-2 ${inputClase}`} />
        </label>
        <label className={`mt-3 ${etiqueta}`}>
          Descripción
          <textarea
            name="descripcion"
            required
            rows="3"
            value={form.descripcion}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={etiqueta}>
            Precio
            <input type="number" min="0" step="0.01" name="precio" required value={form.precio} onChange={cambio} className={`mt-2 ${inputClase}`} />
          </label>
          <label className={etiqueta}>
            Duración (min)
            <input type="number" min="1" name="duracion_minutos" required value={form.duracion_minutos} onChange={cambio} className={`mt-2 ${inputClase}`} />
          </label>
        </div>
        {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}
        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={enviando} className={`flex-1 ${botonPrimario}`}>
            {enviando ? 'Guardando…' : editandoID ? 'Guardar cambios' : 'Crear servicio'}
          </button>
          {editandoID && (
            <button type="button" onClick={cancelarEdicion} className={botonSecundario}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
