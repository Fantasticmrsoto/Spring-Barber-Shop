import { useEffect, useRef, useState } from 'react'
import {
  getBarberos,
  crearBarbero,
  actualizarBarbero,
  subirFotoBarbero,
} from '../../api/barberos'
import { getUsuarios } from '../../api/usuarios'
import { getServicios } from '../../api/servicios'
import { getServiciosDeBarbero, asignarServicio, desasignarServicio } from '../../api/barberoServicios'
import { mensajeDeError } from '../../api/client'
import { precio, urlImagen } from '../../utils/formato'
import { fotoBarbero } from '../../utils/fotosBarbero'
import { inputClase, botonPrimario, botonSecundario, etiqueta, tarjeta } from '../../ui/estilos'

const FICHA_VACIA = {
  comision: '20',
  estado: true,
  descripcion: '',
  especialidad: '',
  instagram: '',
  telefono_contacto: '',
}

export default function AdminBarberos() {
  const [barberos, setBarberos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState({ usuarioID: '', comision: '20', estado: true })
  const [enviando, setEnviando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  // Ficha del barbero que se está editando (comisión, estado y datos públicos).
  const [editandoID, setEditandoID] = useState(null)
  const [ficha, setFicha] = useState(FICHA_VACIA)
  const [guardandoFicha, setGuardandoFicha] = useState(false)

  // Servicios que ofrece el barbero seleccionado.
  const [serviciosDe, setServiciosDe] = useState(null)
  const [asignados, setAsignados] = useState(new Set())

  // Foto del barbero: `fotoDe` es el barbero al que se le está cambiando la
  // foto y `subiendoFoto` el que está subiendo en ese momento. El id se
  // guarda además en una ref porque el manejador del input lo necesita
  // aunque el estado todavía no se haya redibujado.
  const [fotoDe, setFotoDe] = useState(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const inputFoto = useRef(null)
  const fotoDeRef = useRef(null)

  useEffect(() => {
    let activo = true
    Promise.all([getBarberos(), getUsuarios(), getServicios()])
      .then(([b, u, s]) => {
        if (!activo) return
        setBarberos(b)
        setUsuarios(u)
        setServicios(s)
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

  function editar(b) {
    setAviso(null)
    setEditandoID(b.barberoID)
    setFicha({
      comision: String(b.comision ?? 20),
      estado: b.estado ?? true,
      descripcion: b.descripcion ?? '',
      especialidad: b.especialidad ?? '',
      instagram: b.instagram ?? '',
      telefono_contacto: b.telefono_contacto ?? '',
    })
  }

  function cancelarEdicion() {
    setEditandoID(null)
    setFicha(FICHA_VACIA)
    setAviso(null)
  }

  async function guardarFicha(e) {
    e.preventDefault()
    setAviso(null)
    setGuardandoFicha(true)
    try {
      const barbero = await actualizarBarbero(editandoID, {
        comision: Number(ficha.comision),
        estado: ficha.estado,
        descripcion: ficha.descripcion,
        especialidad: ficha.especialidad,
        instagram: ficha.instagram,
        telefono_contacto: ficha.telefono_contacto,
      })
      setBarberos((prev) =>
        prev.map((b) => (b.barberoID === barbero.barberoID ? { ...b, ...barbero } : b)),
      )
      setAviso('Barbero actualizado.')
      setEditandoID(null)
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setGuardandoFicha(false)
    }
  }

  // Al elegir un barbero se cargan los servicios que ofrece.
  async function cargarServicios(barberoID) {
    setServiciosDe(barberoID)
    setAsignados(new Set())
    try {
      const suyos = await getServiciosDeBarbero(barberoID)
      setAsignados(new Set(suyos.map((s) => s.serviciosID)))
    } catch (err) {
      setAviso(mensajeDeError(err))
    }
  }

  async function alternarServicio(servicio) {
    if (!serviciosDe) return
    setAviso(null)
    const asignado = asignados.has(servicio.serviciosID)
    try {
      if (asignado) {
        await desasignarServicio(serviciosDe, servicio.serviciosID)
        setAsignados((prev) => {
          const n = new Set(prev)
          n.delete(servicio.serviciosID)
          return n
        })
      } else {
        await asignarServicio(serviciosDe, servicio.serviciosID)
        setAsignados((prev) => new Set(prev).add(servicio.serviciosID))
      }
    } catch (err) {
      setAviso(mensajeDeError(err))
    }
  }

  /*
   * Cambiar la foto de un barbero.
   *
   * La API lo permite para el administrador y para el propio barbero. Desde
   * aquí se hace lo mismo: el administrador es quien monta el equipo, y no
   * siempre el barbero entra a su panel a subirla.
   */
  async function cambiarFoto(e) {
    const archivo = e.target.files?.[0]
    const barberoId = fotoDeRef.current
    if (!archivo || !barberoId) return
    setAviso(null)
    setSubiendoFoto(true)
    try {
      const barbero = await subirFotoBarbero(barberoId, archivo)
      setBarberos((prev) =>
        prev.map((b) => (b.barberoID === barbero.barberoID ? { ...b, ...barbero } : b)),
      )
      setAviso('Foto actualizada.')
    } catch (err) {
      setAviso(mensajeDeError(err))
    } finally {
      setSubiendoFoto(false)
      if (inputFoto.current) inputFoto.current.value = ''
    }
  }

  return (
    <div className="space-y-8">
      {/* Un único input para todas las fotos: se abre justo después de elegir
          en qué barbero se va a cambiar. */}
      <input
        ref={inputFoto}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={cambiarFoto}
        className="hidden"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div>
          {cargando && <p className="text-cream-200/70">Cargando barberos…</p>}
          {error && <p className="text-red-400">{error}</p>}
          <div className="space-y-2">
            {barberos.map((b) => {
              // Foto de referencia para los barberos que aún no tienen foto
              // subida: es la misma que se ve en la web.
              const foto = fotoBarbero(b.barberoID)
              return (
                <div
                  key={b.barberoID}
                  className={`${tarjeta} flex flex-wrap items-center gap-3 px-4 py-3 ${
                    editandoID === b.barberoID ? 'ring-1 ring-gold-500/60' : ''
                  }`}
                >
                  <img
                    src={b.foto_url ? urlImagen(b.foto_url) : foto.src}
                    srcSet={b.foto_url ? undefined : foto.srcSet}
                    sizes="40px"
                    alt={`${b.nombre} ${b.apellido}`}
                    width="40"
                    height="40"
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                  />
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
                  {b.especialidad && (
                    <span className="text-xs text-cream-200/50">{b.especialidad}</span>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    <button
                      type="button"
                      disabled={subiendoFoto}
                      title="JPG, PNG, WEBP o GIF · máx. 5 MB"
                      onClick={() => {
                        fotoDeRef.current = b.barberoID
                        setFotoDe(b.barberoID)
                        inputFoto.current?.click()
                      }}
                      className="text-xs uppercase tracking-wider text-cream-200/70 transition hover:text-gold-200 disabled:opacity-50"
                    >
                      {subiendoFoto && fotoDe === b.barberoID ? 'Subiendo…' : 'Foto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => editar(b)}
                      className="text-xs uppercase tracking-wider text-gold-300 transition hover:text-gold-200"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
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

          {editandoID && (
            <form
              onSubmit={guardarFicha}
              className="h-fit rounded-xl border border-gold-500/40 bg-ink-900 p-5"
            >
              <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
                Editar barbero
              </h2>

              <label className={`mt-4 ${etiqueta}`}>
                Comisión (%)
                <input
                  type="number"
                  min="0"
                  max="999.99"
                  step="0.01"
                  value={ficha.comision}
                  onChange={(e) => setFicha((f) => ({ ...f, comision: e.target.value }))}
                  className={`mt-2 ${inputClase}`}
                />
              </label>

              <label className="mt-4 flex items-center gap-3 text-sm text-cream-200">
                <input
                  type="checkbox"
                  checked={ficha.estado}
                  onChange={(e) => setFicha((f) => ({ ...f, estado: e.target.checked }))}
                  className="h-4 w-4 accent-gold-500"
                />
                Activo
              </label>

              <label className={`mt-3 ${etiqueta}`}>
                Descripción
                <textarea
                  rows="3"
                  value={ficha.descripcion}
                  onChange={(e) => setFicha((f) => ({ ...f, descripcion: e.target.value }))}
                  className={`mt-2 ${inputClase}`}
                />
              </label>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className={etiqueta}>
                  Especialidad
                  <input
                    value={ficha.especialidad}
                    onChange={(e) => setFicha((f) => ({ ...f, especialidad: e.target.value }))}
                    className={`mt-2 ${inputClase}`}
                  />
                </label>
                <label className={etiqueta}>
                  Instagram
                  <input
                    value={ficha.instagram}
                    onChange={(e) => setFicha((f) => ({ ...f, instagram: e.target.value }))}
                    placeholder="@usuario"
                    className={`mt-2 ${inputClase}`}
                  />
                </label>
              </div>

              <label className={`mt-3 ${etiqueta}`}>
                Teléfono de contacto
                <input
                  value={ficha.telefono_contacto}
                  onChange={(e) => setFicha((f) => ({ ...f, telefono_contacto: e.target.value }))}
                  placeholder="300 000 0000"
                  className={`mt-2 ${inputClase}`}
                />
              </label>

              {aviso && <p className="mt-4 text-sm text-amber-200">{aviso}</p>}

              <div className="mt-5 flex gap-2">
                <button type="submit" disabled={guardandoFicha} className={`flex-1 ${botonPrimario}`}>
                  {guardandoFicha ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={cancelarEdicion} className={botonSecundario}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-ink-900 p-5">
        <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
          Servicios por barbero
        </h2>
        <p className="mt-1 text-xs text-cream-200/50">
          Un barbero solo puede recibir citas de los servicios que tenga aquí. Un servicio sin
          barbero asignado no aparece en la web al reservar.
        </p>

        <label className={`mt-4 ${etiqueta} max-w-xs`}>
          Barbero
          <select
            value={serviciosDe ?? ''}
            onChange={(e) => cargarServicios(e.target.value)}
            className={`mt-2 ${inputClase}`}
          >
            <option value="">Selecciona…</option>
            {barberos.map((b) => (
              <option key={b.barberoID} value={b.barberoID}>
                {b.nombre} {b.apellido}
              </option>
            ))}
          </select>
        </label>

        {serviciosDe && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {servicios.map((s) => {
              const asignado = asignados.has(s.serviciosID)
              return (
                <button
                  key={s.serviciosID}
                  type="button"
                  onClick={() => alternarServicio(s)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    asignado
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/10 bg-ink-800 hover:border-gold-500/50'
                  }`}
                >
                  <span className="text-sm text-cream-50">{s.nombre}</span>
                  <span className="text-xs text-cream-200/50">{precio(s.precio)}</span>
                  <span
                    className={`text-xs uppercase tracking-wider ${
                      asignado ? 'text-emerald-300' : 'text-cream-200/50'
                    }`}
                  >
                    {asignado ? 'Asignado' : 'Asignar'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
