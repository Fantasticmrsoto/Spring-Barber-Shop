import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Cargando from './Cargando'

// Protege una ruta: exige sesión y, opcionalmente, uno de los roles indicados.
export default function ProtectedRoute({ roles, children }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <Cargando />

  if (!usuario) {
    return <Navigate to="/login" state={{ desde: location.pathname }} replace />
  }

  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/" replace />
  }

  return children
}
