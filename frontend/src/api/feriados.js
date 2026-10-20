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
