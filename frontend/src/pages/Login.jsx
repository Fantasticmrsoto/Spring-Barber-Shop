import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { destinoDe } from '../auth/destino'
import { mensajeDeError } from '../api/client'
import { inputClase } from '../ui/estilos'
import logo from '../assets/logo-spring.jpg'

// Recordar el último identificador evita teclearlo cada vez que la sesión expira.
const ULTIMO_USUARIO_KEY = 'barberia.ultimoUsuario'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState(() => ({
    correo: localStorage.getItem(ULTIMO_USUARIO_KEY) ?? '',
    password: '',
  }))
  const [recordar, setRecordar] = useState(true)
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function cambio(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function enviar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const identificador = form.correo.trim()
      const perfil = await iniciarSesion(identificador, form.password)
      if (recordar) localStorage.setItem(ULTIMO_USUARIO_KEY, identificador)
      else localStorage.removeItem(ULTIMO_USUARIO_KEY)
      navigate(destinoDe(perfil, location.state?.desde), { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-ink-950 px-4 py-8 sm:px-5 sm:py-12">
      {/* `my-auto` centra el bloque mientras haya sitio y, cuando el formulario
          es más alto que la pantalla, deja que la página se desplace sin que
          la cabecera quede cortada. */}
      <div className="my-auto flex w-full flex-col items-center">
        <Link to="/" className="mb-6 flex flex-col items-center sm:mb-8">
          <img
            src={logo}
            alt="Spring Barber Shop"
            className="h-20 w-20 rounded-full object-cover shadow-lg shadow-black/50 sm:h-28 sm:w-28"
          />
        </Link>

        <form
          onSubmit={enviar}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 p-5 sm:p-7"
        >
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Iniciar sesión
        </h1>
        <p className="mt-1 text-sm text-cream-200/60">
          Accede para reservar y gestionar tus citas.
        </p>

        <label className="mt-6 block text-xs uppercase tracking-wider text-cream-200/70">
          Correo o teléfono
          <input
            autoFocus
            type="text"
            name="correo"
            inputMode="email"
            autoComplete="username"
            required
            value={form.correo}
            onChange={cambio}
            className={`mt-2 ${inputClase}`}
            placeholder="tu@correo.com o 300 000 0000"
          />
        </label>

        <label className="mt-4 block text-xs uppercase tracking-wider text-cream-200/70">
          Contraseña
          <div className="relative mt-2">
            <input
              type={verClave ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={cambio}
              className={`${inputClase} pr-16`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              className="absolute inset-y-0 right-0 px-4 text-xs font-semibold uppercase tracking-wider text-cream-200/60 transition hover:text-gold-400"
            >
              {verClave ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm text-cream-200/70">
          <input
            type="checkbox"
            checked={recordar}
            onChange={(e) => setRecordar(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-gold-500"
          />
          Recordar mi usuario
        </label>

        <p className="mt-3 text-right text-sm">
          <Link to="/recuperar" className="text-cream-200/60 hover:text-gold-400">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

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
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="mt-5 text-center text-sm text-cream-200/60">
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-semibold text-gold-400 hover:underline">
            Regístrate
          </Link>
        </p>
      </form>
      </div>
    </div>
  )
}
