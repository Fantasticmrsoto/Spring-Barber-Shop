import client from './client'

export async function getUsuarios() {
  const { data } = await client.get('/api/usuarios')
  return data.usuarios ?? []
}

export async function getUsuario(usuarioID) {
  const { data } = await client.get(`/api/usuarios/${usuarioID}`)
  return data.usuario
}

export async function crearUsuario(payload) {
  const { data } = await client.post('/api/usuarios', payload)
  return { usuario: data.usuario, citasVinculadas: data.citasVinculadas ?? 0 }
}

export async function actualizarUsuario(usuarioID, payload) {
  const { data } = await client.put(`/api/usuarios/${usuarioID}`, payload)
  return data.usuario
}

export async function eliminarUsuario(usuarioID) {
  const { data } = await client.delete(`/api/usuarios/${usuarioID}`)
  return data
}

// Autoservicio: el usuario edita su propio perfil (el usuario sale del token).
export async function actualizarMiPerfil(payload) {
  const { data } = await client.put('/api/usuarios/perfil', payload)
  return data.usuario
}
