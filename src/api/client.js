import axios from 'axios'

// El backend expone todo bajo http://localhost:3000 (ver documentacion/API.md).
// Se puede sobreescribir con VITE_API_URL en un archivo .env.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const TOKEN_KEY = 'barberia.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Adjunta el JWT en cada peticion protegida.
client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// No hay endpoint de logout ni refresh (el token dura 8h): ante un 401 se
// descarta la sesion para que la app vuelva a pedir credenciales.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setToken(null)
      window.dispatchEvent(new Event('barberia:sesion-expirada'))
    }
    return Promise.reject(error)
  },
)

// El backend siempre responde { ok, message|error, ...data }. Esta ayuda extrae
// un mensaje listo para mostrar al usuario.
export function mensajeDeError(error) {
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    'No se pudo conectar con el servidor'
  )
}

export default client
