import client from './client'

// Resumen de negocio del administrador (solo ese rol puede consultarlo).
export async function getResumen() {
  const { data } = await client.get('/api/estadisticas/resumen')
  return data
}
