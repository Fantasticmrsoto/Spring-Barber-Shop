import { useEffect, useState } from 'react'
import {
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from '../../api/usuarios'
import { mensajeDeError } from '../../api/client'
import { inputClase, botonPrimario, botonSecundario, etiqueta, tarjeta } from '../../ui/estilos'

const VACIO = {
  usuarioID: null,
  nombre: '',
  apellido: '',
  correo: '',
  telefono: '',
  clave: '',
  rol: 'cliente',
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  const editando = form.usuarioID !== null

  useEffect(() => {
    let activo = true
    getUsuarios()
      .then((u) => activo && setUsuarios(u))
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [recarga])

  function cambio(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  function editar(u) {
    setAviso(null)
    setForm({
      usuarioID: u.usuarioID,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      telefono: u.telefono,
      clave: '',
      rol: u.rol,
    })
  }

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    setError(null)
    setEnviando(true)
    try {
      if (editando) {
        const payload = {
          nombre: form.nombre,
          apellido: form.apellido,
          correo: form.correo,
          telefono: form.telefono,
          rol: form.rol,
        }
        if (form.clave) payload.clave = form.clave
        await actualizarUsuario(form.usuarioID, payload)
        setAviso('Usuario actualizado.')
      } else {
        await crearUsuario({
          nombre: form.nombre,
          apellido: form.apellido,
          correo: form.correo,
          telefono: form.telefono,
          clave: form.clave,
          rol: form.rol,
        })
        setAviso('Usuario creado.')
      }
      setForm(VACIO)
      setRecarga((n) => n + 1)
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(u) {
    if (!window.confirm(`¿Eliminar a ${u.nombre} ${u.apellido}?`)) return
    setAviso(null)
    try {
      await eliminarUsuario(u.usuarioID)
      if (form.usuarioID === u.usuarioID) setForm(VACIO)
      setRecarga((n) => n + 1)
    } catch (err) {
      setAviso(mensajeDeError(err))
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        {cargando && <p className="text-cream-200/70">Cargando usuarios…</p>}
        {error && <p className="text-red-400">{error}</p>}
        <div className="space-y-2">
          {usuarios.map((u) => (
            <div
              key={u.usuarioID}
              className={`${tarjeta} flex flex-wrap items-center gap-3 px-4 py-3`}
            >
              <div className="min-w-[12rem]">
                <p className="text-sm font-semibold text-cream-50">
                  {u.nombre} {u.apellido}
                </p>
                <p className="text-xs text-cream-200/50">{u.correo}</p>
              </div>
              <span className="text-xs text-cream-200/60">{u.telefono}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wider text-cream-200">
                {u.rol}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => editar(u)}
                  className="text-xs uppercase tracking-wider text-gold-300 hover:text-gold-200"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => borrar(u)}
                  className="text-xs uppercase tracking-wider text-red-300 hover:text-red-200"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={enviar} className="h-fit rounded-xl border border-white/10 bg-ink-900 p-5">
        <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
          {editando ? 'Editar usuario' : 'Nuevo usuario'}
        </h2>

        <label className={`mt-4 ${etiqueta}`}>
          Nombre
          <input name="nombre" required value={form.nombre} onChange={cambio} className={`mt-2 ${inputClase}`} />
        </label>
        <label className={`mt-3 ${etiqueta}`}>
          Apellido
          <input name="apellido" required value={form.apellido} onChange={cambio} className={`mt-2 ${inputClase}`} />
        </label>
        <label className={`mt-3 ${etiqueta}`}>
          Correo
          <input type="email" name="correo" required value={form.correo} onChange={cambio} className={`mt-2 ${inputClase}`} />
        </label>
        <label className={`mt-3 ${etiqueta}`}>
          Teléfono
          <input name="telefono" required value={form.telefono} onChange={cambio} className={`mt-2 ${inputClase}`} />
        </label>
        <label className={`mt-3 ${etiqueta}`}>
          {editando ? 'Nueva contraseña (opcional)' : 'Contraseña'}
          <input
            type="password"
            name="clave"
            required={!editando}
            value={form.clave}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
          />
        </label>
        <label className={`mt-3 ${etiqueta}`}>
          Rol
          <select name="rol" value={form.rol} onChange={cambio} className={`mt-2 ${inputClase}`}>
            <option value="cliente">Cliente</option>
            <option value="barbero">Barbero</option>
            <option value="administrador">Administrador</option>
          </select>
        </label>

        {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}

        <div className="mt-5 flex gap-2">
          <button type="submit" disabled={enviando} className={botonPrimario}>
            {editando ? 'Guardar' : 'Crear'}
          </button>
          {editando && (
            <button type="button" onClick={() => setForm(VACIO)} className={botonSecundario}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
