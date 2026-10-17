import client from './client'

export async function getServicios() {
  const { data } = await client.get('/api/servicios')
  return data.servicios ?? []
}

export async function crearServicio(payload) {
  const { data } = await client.post('/api/servicios', payload)
  return data.servicio
}

export async function actualizarServicio(serviciosID, payload) {
  const { data } = await client.put(`/api/servicios/${serviciosID}`, payload)
  return data.servicio
}

export async function eliminarServicio(serviciosID) {
  const { data } = await client.delete(`/api/servicios/${serviciosID}`)
  return data
}
