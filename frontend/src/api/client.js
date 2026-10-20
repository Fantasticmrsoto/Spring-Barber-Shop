import axios from 'axios'

// El backend expone todo bajo http://<host>:3000 (ver documentacion/API.md).
// Por defecto el host se deduce del que se sirvio la web, de modo que la app
// funciona igual en el PC (localhost) que en el movil (IP de la red local)
// sin editar nada cuando la IP del equipo cambia. Si hace falta apuntar a
// otro backend, se define VITE_API_URL en un archivo .env.
const API_POR_DEFECTO =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : 'http://localhost:3000'

export const API_URL = import.meta.env.VITE_API_URL || API_POR_DEFECTO

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
