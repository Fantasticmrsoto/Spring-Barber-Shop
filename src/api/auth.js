import client, { setToken } from './client'

export async function login(correo, password) {
  const { data } = await client.post('/api/auth/login', { correo, password })
  setToken(data.token)
  return data.usuario
}

export async function perfil() {
  const { data } = await client.get('/api/auth/me')
  return data.usuario
}

// Recuperación sin correo saliente: se confirma la identidad con correo + teléfono.
export async function recuperarClave({ correo, telefono, claveNueva }) {
  const { data } = await client.post('/api/auth/recuperar', { correo, telefono, claveNueva })
  return data
}
