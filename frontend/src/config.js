// Datos de contacto del negocio. Cambia `telefonoWhatsApp` por el número real
// en formato internacional, sin "+", espacios ni guiones.
export const CONTACTO = {
  // 0412-4370853 en formato internacional para wa.me (Venezuela +58, sin el 0).
  telefonoWhatsApp: '584124370853',
  telefonoVisible: '+58 412-4370853',
  correo: 'hola@springbarber.com',
  direccion: 'Spring Group Barber Shop, Valencia, Carabobo, Venezuela',
  mapaUrl: 'https://maps.app.goo.gl/3wNVG66QWCdVYPjQ7',
}

export function enlaceWhatsApp(mensaje) {
  const texto = encodeURIComponent(
    mensaje || 'Hola, quiero reservar una cita en Spring Barber Shop.',
  )
  return `https://wa.me/${CONTACTO.telefonoWhatsApp}?text=${texto}`
}
