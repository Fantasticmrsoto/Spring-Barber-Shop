import client from './client'

export async function getBarberos() {
  const { data } = await client.get('/api/barberos')
  return data.barberos ?? []
}

export async function crearBarbero(payload) {
  const { data } = await client.post('/api/barberos', payload)
  return data.barbero
}

// Edición parcial del perfil. El backend ignora comision/estado si el token no
// es de administrador.
export async function actualizarBarbero(barberoID, datos) {
  const { data } = await client.put(`/api/barberos/${barberoID}`, datos)
  return data.barbero
}

// Sube la foto de perfil (multipart). Se quita el Content-Type por defecto para
// que axios/browser pongan el boundary correcto.
export async function subirFotoBarbero(barberoID, archivo) {
  const formData = new FormData()
  formData.append('foto', archivo)
  const { data } = await client.post(`/api/barberos/${barberoID}/foto`, formData, {
    headers: { 'Content-Type': undefined },
  })
  return data.barbero
}

// Quita a un barbero del equipo (solo el administrador). Borra la ficha: sus
// horarios, sus servicios asignados y sus citas se van en cascada.
export async function eliminarBarbero(barberoID) {
  const { data } = await client.delete(`/api/barberos/${barberoID}`)
  return data
}

// Reseñas públicas de un barbero: { total, promedio, resenas: [...] }
export async function getResenasBarbero(barberoID) {
  const { data } = await client.get(`/api/barberos/${barberoID}/resenas`)
  return { total: data.total ?? 0, promedio: data.promedio ?? 0, resenas: data.resenas ?? [] }
}

// Crea o actualiza la reseña del usuario autenticado (exige una cita completada).
// El administrador puede pasar `autorID` para dejar la reseña en nombre de un
// cliente.
export async function crearResenaBarbero(barberoID, { calificacion, comentario, autorID } = {}) {
  const { data } = await client.post(`/api/barberos/${barberoID}/resenas`, {
    calificacion,
    comentario,
    ...(autorID ? { autorID } : {}),
  })
  return data.resena
}

// Todas las reseñas (solo administrador), con barbero y autor ya unidos.
export async function getTodasResenas() {
  const { data } = await client.get('/api/barberos/resenas')
  return data.resenas ?? []
}

// Elimina una reseña (solo administrador).
export async function eliminarResena(resenaID) {
  const { data } = await client.delete(`/api/barberos/resenas/${resenaID}`)
  return data
}
