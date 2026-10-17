import client from './client'

export async function getServiciosDeBarbero(barberoID) {
  const { data } = await client.get(`/api/barbero-servicios/barbero/${barberoID}`)
  return data.servicios ?? []
}

export async function asignarServicio(barberoID, servicioID) {
  const { data } = await client.post('/api/barbero-servicios', { barberoID, servicioID })
  return data.asignacion
}

export async function desasignarServicio(barberoID, servicioID) {
  const { data } = await client.delete(`/api/barbero-servicios/${barberoID}/${servicioID}`)
  return data
}
