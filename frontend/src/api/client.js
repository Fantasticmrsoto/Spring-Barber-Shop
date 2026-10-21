import axios from 'axios'

// URL base de la API.
//
// Se resuelve en este orden:
//
//  1. `VITE_API_URL` — si está definida, manda ella. Es lo que se usa cuando la
//     web y la API están en dominios distintos (web en Vercel, API en Render).
//
//  2. `` (vacío) — en la build de producción la API se sirve bajo el mismo
//     dominio que la web (el proxy inverso de nginx, de Vercel o de Cloudflare
//     reenvía `/api/*` al backend). Con la raíz del origen como base, el primer
//     `/api` de cada path da el endpoint final (`/api/citas`). Si aquí se pusiera
//     `/api`, axios concatenaría el prefijo una segunda vez y la petición
//     saldría en `/api/api/citas`, un 404. En desarrollo la base es la URL
//     completa del backend y el path ya lleva su `/api`.
//
//  3. `http://<misma-IP>:3000` — en desarrollo la API va en otro puerto, así
//     que se deduce del host con el que se sirvió la web: la app funciona
//     igual en el PC (localhost) y en el móvil (IP de la red local) sin editar
//     nada cuando la IP del equipo cambia.
const API_POR_DEFECTO = import.meta.env.PROD
  ? ''
  : typeof window !== 'undefined'
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
