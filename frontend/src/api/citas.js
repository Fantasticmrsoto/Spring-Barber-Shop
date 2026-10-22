import client from './client'

export async function getCitas() {
  const { data } = await client.get('/api/citas')
  return data.citas ?? []
}

/*
 * Prepara el cuerpo de una reserva.
 *
 * Si hay comprobante (pago móvil) la petición va en multipart, con el archivo
 * y los campos de la reserva en el mismo formulario: así la cita y su
 * comprobante se guardan en una sola llamada. Sin comprobante va en JSON,
 * como siempre.
 */
function cuerpoReserva({ comprobante, ...datos }) {
  if (!comprobante) return { cuerpo: datos, multipart: false }

  const form = new FormData()
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined || valor === null || valor === '') continue
    form.append(clave, String(valor))
  }
  form.append('comprobante', comprobante)

  return { cuerpo: form, multipart: true }
}

// El cliente global fija 'application/json' por defecto y axios, al ver
// 'application/json' + FormData, serializa el form a JSON y pierde el archivo.
// Forzando 'multipart/form-data' axios arma el multipart con su boundary solo.
const cabecera = (multipart) =>
  multipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}

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
  const { cuerpo, multipart } = cuerpoReserva(payload)
  const { data } = await client.post('/api/citas', cuerpo, cabecera(multipart))
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
  const { cuerpo, multipart } = cuerpoReserva(payload)
  const { data } = await client.post('/api/citas/publica', cuerpo, cabecera(multipart))
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
