import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { actualizarMiPerfil } from '../api/usuarios'
import { mensajeDeError } from '../api/client'
import { inputClase, botonPrimario, etiqueta, tarjeta } from '../ui/estilos'
import AppHeader from '../components/AppHeader'

export default function Perfil() {
  const { usuario, refrescar } = useAuth()

  const [datos, setDatos] = useState(() => ({
    nombre: usuario?.nombre ?? '',
    apellido: usuario?.apellido ?? '',
    correo: usuario?.correo ?? '',
    telefono: usuario?.telefono ?? '',
  }))
  const [claves, setClaves] = useState({ claveActual: '', claveNueva: '', confirmar: '' })

  const [guardandoDatos, setGuardandoDatos] = useState(false)
  const [avisoDatos, setAvisoDatos] = useState(null)
  const [errorDatos, setErrorDatos] = useState(null)

  const [guardandoClave, setGuardandoClave] = useState(false)
  const [avisoClave, setAvisoClave] = useState(null)
  const [errorClave, setErrorClave] = useState(null)

  function cambioDatos(e) {
    setDatos((d) => ({ ...d, [e.target.name]: e.target.value }))
  }
  function cambioClaves(e) {
    setClaves((c) => ({ ...c, [e.target.name]: e.target.value }))
  }

  async function guardarDatos(e) {
    e.preventDefault()
    setErrorDatos(null)
    setAvisoDatos(null)
    setGuardandoDatos(true)
    try {
      await actualizarMiPerfil({
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        correo: datos.correo.trim(),
        telefono: datos.telefono.trim(),
      })
      await refrescar()
      setAvisoDatos('Datos actualizados.')
    } catch (err) {
      setErrorDatos(mensajeDeError(err))
    } finally {
      setGuardandoDatos(false)
    }
  }

  async function cambiarClave(e) {
    e.preventDefault()
    setErrorClave(null)
    setAvisoClave(null)
    if (claves.claveNueva.length < 6) {
      setErrorClave('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (claves.claveNueva !== claves.confirmar) {
      setErrorClave('Las contraseñas no coinciden')
      return
    }
    setGuardandoClave(true)
    try {
      await actualizarMiPerfil({
        claveActual: claves.claveActual,
        claveNueva: claves.claveNueva,
      })
      setClaves({ claveActual: '', claveNueva: '', confirmar: '' })
      setAvisoClave('Contraseña actualizada.')
    } catch (err) {
      setErrorClave(mensajeDeError(err))
    } finally {
      setGuardandoClave(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Mi perfil</h1>
        <p className="mt-1 text-sm text-cream-200/60">
          {usuario?.rol === 'cliente'
            ? 'Actualiza tus datos y revisa tu historial de citas.'
            : 'Actualiza tus datos de contacto y tu contraseña.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/mis-citas" className="text-sm font-semibold text-gold-400 hover:underline">
            Ver mis citas
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={guardarDatos} className={`${tarjeta} h-fit p-5`}>
            <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
              Datos personales
            </h2>

            <label className={`mt-4 ${etiqueta}`}>
              Nombre
              <input
                name="nombre"
                required
                value={datos.nombre}
                onChange={cambioDatos}
                className={`mt-2 ${inputClase}`}
              />
            </label>
            <label className={`mt-3 ${etiqueta}`}>
              Apellido
              <input
                name="apellido"
                required
                value={datos.apellido}
                onChange={cambioDatos}
                className={`mt-2 ${inputClase}`}
              />
            </label>
            <label className={`mt-3 ${etiqueta}`}>
              Correo
              <input
                type="email"
                name="correo"
                required
                value={datos.correo}
                onChange={cambioDatos}
                className={`mt-2 ${inputClase}`}
              />
            </label>
            <label className={`mt-3 ${etiqueta}`}>
              Teléfono
              <input
                name="telefono"
                required
                value={datos.telefono}
                onChange={cambioDatos}
                className={`mt-2 ${inputClase}`}
              />
            </label>

            {errorDatos && <p className="mt-4 text-sm text-red-300">{errorDatos}</p>}
            {avisoDatos && <p className="mt-4 text-sm text-emerald-300">{avisoDatos}</p>}

            <button type="submit" disabled={guardandoDatos} className={`mt-5 ${botonPrimario}`}>
              {guardandoDatos ? 'Guardando…' : 'Guardar datos'}
            </button>
          </form>

          <form onSubmit={cambiarClave} className={`${tarjeta} h-fit p-5`}>
            <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
              Cambiar contraseña
            </h2>

            <label className={`mt-4 ${etiqueta}`}>
              Contraseña actual
              <input
                type="password"
                name="claveActual"
                autoComplete="current-password"
                required
                value={claves.claveActual}
                onChange={cambioClaves}
                className={`mt-2 ${inputClase}`}
              />
            </label>
            <label className={`mt-3 ${etiqueta}`}>
              Nueva contraseña
              <input
                type="password"
                name="claveNueva"
                autoComplete="new-password"
                required
                value={claves.claveNueva}
                onChange={cambioClaves}
                className={`mt-2 ${inputClase}`}
              />
            </label>
            <label className={`mt-3 ${etiqueta}`}>
              Repite la nueva contraseña
              <input
                type="password"
                name="confirmar"
                autoComplete="new-password"
                required
                value={claves.confirmar}
                onChange={cambioClaves}
                className={`mt-2 ${inputClase}`}
              />
            </label>

            {errorClave && <p className="mt-4 text-sm text-red-300">{errorClave}</p>}
            {avisoClave && <p className="mt-4 text-sm text-emerald-300">{avisoClave}</p>}

            <button type="submit" disabled={guardandoClave} className={`mt-5 ${botonPrimario}`}>
              {guardandoClave ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
