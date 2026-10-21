import client from './client'

// Días en los que no se puede reservar: los de descanso (domingos) y los
// feriados. Es pública: la web la necesita antes de que el cliente haya
// iniciado sesión.
export async function getFeriados() {
  const { data } = await client.get('/api/feriados')
  return {
    diasDescanso: data.dias_descanso ?? [],
    feriados: data.feriados ?? [],
  }
}

// Registra un día no laborable (solo administrador).
export async function crearFeriado({ fecha, nombre, tipo }) {
  const { data } = await client.post('/api/feriados', { fecha, nombre, tipo })
  return data.feriado
}

// Quita un día no laborable (solo administrador).
export async function eliminarFeriado(fecha) {
  const { data } = await client.delete(`/api/feriados/${fecha}`)
  return data.feriado
}
