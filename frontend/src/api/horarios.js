import client from './client'

export async function getHorariosDeBarbero(barberoID) {
  const { data } = await client.get(`/api/horarios/barbero/${barberoID}`)
  return data.horarios ?? []
}

// Upsert: si el barbero ya tiene ese día, lo reemplaza.
export async function guardarHorario(payload) {
  const { data } = await client.post('/api/horarios', payload)
  return data.horario
}

export async function eliminarHorario(barberoID, dia) {
  const { data } = await client.delete(`/api/horarios/barbero/${barberoID}/${dia}`)
  return data
}
