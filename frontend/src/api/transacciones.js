import client from './client'

// Lista pagos. El backend acota por rol: admin ve todos, el cliente solo los suyos.
export async function getTransacciones(params = {}) {
  const { data } = await client.get('/api/transacciones', { params })
  return data.transacciones ?? []
}

export async function getPago(transaccionID) {
  const { data } = await client.get(`/api/transacciones/${transaccionID}`)
  return data.transaccion
}

// Registra el pago de una cita. Con `comprobante` (File) se envía multipart
// (pago móvil del cliente); sin él va como JSON (efectivo/tarjeta del admin).
export async function crearPago({ citaID, metodo_pago, referencia_pago, monto, comprobante } = {}) {
  let payload

  if (comprobante) {
    const form = new FormData()
    form.append('citaID', String(citaID))
    form.append('metodo_pago', metodo_pago)
    if (referencia_pago) form.append('referencia_pago', referencia_pago)
    if (monto !== undefined && monto !== null && monto !== '') form.append('monto', String(monto))
    form.append('comprobante', comprobante)
    payload = form
  } else {
    payload = { citaID, metodo_pago, referencia_pago, monto }
  }

  const { data } = await client.post('/api/transacciones', payload, {
    // El cliente global fija 'application/json' por defecto y axios, al ver
    // 'application/json' + FormData, serializa el form a JSON y pierde el archivo.
    // Forzando 'multipart/form-data' axios arma el multipart con su boundary solo.
    ...(comprobante ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  })
  return data.transaccion
}

export async function aprobarPago(transaccionID) {
  const { data } = await client.put(`/api/transacciones/${transaccionID}/aprobar`)
  return data.transaccion
}

export async function rechazarPago(transaccionID, motivo) {
  const { data } = await client.put(`/api/transacciones/${transaccionID}/rechazar`, { motivo })
  return data.transaccion
}
