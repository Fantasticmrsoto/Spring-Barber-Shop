import { API_URL } from '../api/client'

// El backend devuelve precio/comision/monto como string numerico de PostgreSQL
// (ej. "15.00"). Se normaliza a numero antes de formatear.
export function aNumero(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export function precio(valor) {
  return `$${aNumero(valor).toFixed(2)}`
}

export function duracion(minutos) {
  const m = aNumero(minutos)
  if (m < 60) return `${m} min`
  const horas = Math.floor(m / 60)
  const resto = m % 60
  return resto ? `${horas} h ${resto} min` : `${horas} h`
}

/*
 * Días de la semana, en el mismo formato que el CHECK de la base de datos
 * (`horario_laboral_dia_check`): minúsculas y sin tilde.
 *
 * El orden es lunes → domingo. Antes cada fichero tenía su propia lista y
 * dos órdenes distintos (domingo primero en unos, lunes primero en otros),
 * lo que hacía que un mismo día se mostrara en sitios diferentes.
 */
export const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
]

/*
 * Iniciales para el avatar de una persona ("Carlos Navas" → "CN").
 *
 * Estaba copiado en cuatro componentes; ahora se importa de aquí.
 */
export function iniciales(nombre = '', apellido = '') {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()
}

export function capitalizar(texto = '') {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * Fecha "YYYY-MM-DD" en texto legible: "1 de enero".
 *
 * Se construye con las partes de la fecha en local, no con `toISOString()`,
 * que convertiría a UTC y en husos horarios positivos se perdería un día.
 */
export function formatearFechaLarga(fechaYmd) {
  if (!fechaYmd) return ''
  const [anio, mes, dia] = fechaYmd.split('-').map(Number)
  if (!anio || !mes || !dia) return fechaYmd
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${dia} de ${meses[mes - 1]}`
}

export function fechaHora(valor) {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

/*
 * Nombre de quien tiene la cita.
 *
 * Una cita puede ser de un cliente registrado (con cuenta) o de un invitado
 * (alguien que reservó sin cuenta). En el caso del invitado no hay
 * `cliente_nombre`: el nombre está en `contacto_nombre`. Sin esta ayuda, los
 * sitios que muestran el nombre del cliente se veían en blanco justo en las
 * citas de invitado, que son las que se ven desde el panel.
 */
export function nombreCliente(cita) {
  if (!cita) return ''
  if (cita.es_invitado) return cita.contacto_nombre || ''
  return `${cita.cliente_nombre ?? ''} ${cita.cliente_apellido ?? ''}`.trim()
}

// El backend guarda la foto como ruta relativa ("/uploads/foto.jpg"). Se
// convierte a URL absoluta; una URL ya completa o un data: se dejan igual.
export function urlImagen(ruta) {
  if (!ruta) return null
  if (/^(https?:)?\/\//i.test(ruta) || ruta.startsWith('data:')) return ruta
  return `${API_URL}${ruta.startsWith('/') ? '' : '/'}${ruta}`
}

// Acepta "@usuario", "usuario" o una URL completa de Instagram.
export function usuarioInstagram(valor) {
  if (!valor) return null
  const v = String(valor).trim()
  if (/^https?:\/\//i.test(v)) {
    const ultimo = v.replace(/\/+$/, '').split('/').pop()
    return ultimo || null
  }
  return v.replace(/^@/, '') || null
}

export function enlaceInstagram(valor) {
  if (!valor) return null
  const v = String(valor).trim()
  if (/^https?:\/\//i.test(v)) return v
  const usuario = usuarioInstagram(v)
  return usuario ? `https://instagram.com/${usuario}` : null
}

// Enlace de WhatsApp a partir de un teléfono cualquiera (acepta espacios, +, guiones).
export function enlaceWhatsAppNumero(telefono, mensaje) {
  const digitos = String(telefono || '').replace(/\D/g, '')
  if (!digitos) return null
  const texto = encodeURIComponent(mensaje || 'Hola, quiero reservar una cita.')
  return `https://wa.me/${digitos}?text=${texto}`
}
