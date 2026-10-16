import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { crearUsuario } from '../api/usuarios'
import { mensajeDeError } from '../api/client'
import logo from '../assets/logo-spring.jpg'

const inputClase =
  'w-full rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-cream-50 outline-none transition placeholder:text-cream-200/40 focus:border-gold-500'

const inicial = {
  nombre: '',
  apellido: '',
  correo: '',
  telefono: '',
  clave: '',
  confirmar: '',
}

export default function Registro() {
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Si se llega desde la reserva de invitado, se rellenan los datos ya escritos
  // (el teléfono permite vincular la cita reservada a la nueva cuenta).
  const [form, setForm] = useState(() => ({
    ...inicial,
    nombre: location.state?.nombre ?? '',
    apellido: location.state?.apellido ?? '',
    telefono: location.state?.telefono ?? '',
  }))
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function cambio(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function enviar(e) {
    e.preventDefault()
    setError(null)

    if (form.clave.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (form.clave !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setEnviando(true)
    try {
      const { citasVinculadas } = await crearUsuario({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        correo: form.correo.trim(),
        telefono: form.telefono.trim(),
        clave: form.clave,
        rol: 'cliente',
      })
      // Tras registrar, se inicia sesión automáticamente.
      await iniciarSesion(form.correo.trim(), form.clave)
      // Si su teléfono tenía citas de invitado, ya quedaron vinculadas: lo llevamos
      // a "Mis citas" para que las vea.
      navigate(citasVinculadas > 0 ? '/mis-citas' : '/reservar', { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const campos = [
    { name: 'nombre', label: 'Nombre', type: 'text' },
    { name: 'apellido', label: 'Apellido', type: 'text' },
    { name: 'correo', label: 'Correo', type: 'email' },
    { name: 'telefono', label: 'Teléfono', type: 'tel' },
  ]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-5 py-12">
      <Link to="/" className="mb-8 flex flex-col items-center">
        <img
          src={logo}
          alt="Spring Barber Shop"
          className="h-32 w-32 rounded-full object-cover shadow-lg shadow-black/50"
        />
      </Link>

      <form
        onSubmit={enviar}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-7"
      >
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Crear cuenta
        </h1>
        <p className="mt-1 text-sm text-cream-200/60">
          Regístrate para agendar tu primera cita.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {campos.map((campo) => (
            <label
              key={campo.name}
              className="block text-xs uppercase tracking-wider text-cream-200/70"
            >
              {campo.label}
              <input
                type={campo.type}
                name={campo.name}
                required
                value={form[campo.name]}
                onChange={cambio}
                className={`mt-2 ${inputClase}`}
              />
            </label>
          ))}
        </div>

        <label className="mt-4 block text-xs uppercase tracking-wider text-cream-200/70">
          Contraseña
          <input
            type="password"
            name="clave"
            autoComplete="new-password"
            required
            value={form.clave}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
          />
        </label>

        <label className="mt-4 block text-xs uppercase tracking-wider text-cream-200/70">
          Repite la contraseña
          <input
            type="password"
            name="confirmar"
            autoComplete="new-password"
            required
            value={form.confirmar}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
          />
        </label>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="mt-6 w-full rounded-full bg-gold-500 py-3 text-sm font-semibold uppercase tracking-wider text-ink-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>

        <p className="mt-5 text-center text-sm text-cream-200/60">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-semibold text-gold-400 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
