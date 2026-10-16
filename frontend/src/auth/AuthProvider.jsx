import { useCallback, useEffect, useMemo, useState } from 'react'
import { getToken, setToken } from '../api/client'
import * as authApi from '../api/auth'
import { AuthContext } from './contexto'

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  // `cargando` evita redirigir al login antes de saber si el token sigue vivo.
  const [cargando, setCargando] = useState(true)

  // Al arrancar, si hay token, se rehidrata la sesión con GET /api/auth/me.
  useEffect(() => {
    let activo = true

    async function rehidratar() {
      if (!getToken()) {
        setCargando(false)
        return
      }
      try {
        const perfil = await authApi.perfil()
        if (activo) setUsuario(perfil)
      } catch {
        if (activo) setToken(null)
      } finally {
        if (activo) setCargando(false)
      }
    }

    rehidratar()
    return () => {
      activo = false
    }
  }, [])

  // El interceptor de axios dispara este evento ante un 401.
  useEffect(() => {
    const alExpirar = () => setUsuario(null)
    window.addEventListener('barberia:sesion-expirada', alExpirar)
    return () => window.removeEventListener('barberia:sesion-expirada', alExpirar)
  }, [])

  const iniciarSesion = useCallback(async (correo, password) => {
    const perfil = await authApi.login(correo, password)
    setUsuario(perfil)
    return perfil
  }, [])

  const cerrarSesion = useCallback(() => {
    setToken(null)
    setUsuario(null)
  }, [])

  // Relee el perfil del token. Lo usa "Mi perfil" tras guardar, para que el
  // encabezado muestre los datos nuevos sin recargar la página.
  const refrescar = useCallback(async () => {
    const perfil = await authApi.perfil()
    setUsuario(perfil)
    return perfil
  }, [])

  const valor = useMemo(
    () => ({ usuario, cargando, iniciarSesion, cerrarSesion, refrescar }),
    [usuario, cargando, iniciarSesion, cerrarSesion, refrescar],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}
