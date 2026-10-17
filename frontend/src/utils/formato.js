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

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export function nombreDia(indice) {
  return DIAS[indice] ?? ''
}

export function capitalizar(texto = '') {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function fechaHora(valor) {
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

// Índice de día (0 = domingo) para una fecha local "YYYY-MM-DD".
export function diaDeFecha(fechaYmd) {
  return new Date(`${fechaYmd}T00:00:00`).getDay()
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
