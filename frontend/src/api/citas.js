import client from './client'

export async function getCitas() {
  const { data } = await client.get('/api/citas')
  return data.citas ?? []
}

// Horas ocupadas de un barbero (endpoint público). Devuelve [{ fecha_inicio, fecha_fin }].
// `excluir` omite una cita (la que se está reprogramando) de las horas ocupadas.
export async function getOcupados(barberoID, { desde, hasta, excluir } = {}) {
  const params = { barberoID }
  if (desde) params.desde = desde
  if (hasta) params.hasta = hasta
  if (excluir) params.excluir = excluir
  const { data } = await client.get('/api/citas/ocupados', { params })
  return data.ocupados ?? []
}

export async function crearCita(payload) {
  const { data } = await client.post('/api/citas', payload)
  return data.cita
}

export async function cambiarEstadoCita(citaID, estado) {
  const { data } = await client.put(`/api/citas/${citaID}/estado`, { estado })
  return data.cita
}

// Reprograma una cita (solo cambia la fecha y hora).
export async function reprogramarCita(citaID, { fecha_hora }) {
  const { data } = await client.put(`/api/citas/${citaID}`, { fecha_hora })
  return data.cita
}

// Reserva pública (sin sesión). Devuelve { cita, codigo } — el codigo permite ver y
// cancelar la cita sin cuenta.
export async function crearCitaPublica(payload) {
  const { data } = await client.post('/api/citas/publica', payload)
  return { cita: data.cita, codigo: data.codigo }
}

export async function getCitaPublica(codigo) {
  const { data } = await client.get(`/api/citas/publica/${codigo}`)
  return data.cita
}

export async function cancelarCitaPublica(codigo) {
  const { data } = await client.put(`/api/citas/publica/${codigo}/estado`)
  return data.cita
}
