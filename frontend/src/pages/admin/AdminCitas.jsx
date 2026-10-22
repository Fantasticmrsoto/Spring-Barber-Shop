import { useEffect, useState } from 'react'
import { getCitas } from '../../api/citas'
import { mensajeDeError } from '../../api/client'
import ListaCitas from '../../components/ListaCitas'

export default function AdminCitas() {
  const [citas, setCitas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    getCitas()
      .then((data) => activo && setCitas(data))
      .catch((err) => activo && setError(mensajeDeError(err)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  function actualizar(actualizada) {
    setCitas((prev) =>
      prev.map((c) => (c.citaID === actualizada.citaID ? { ...c, ...actualizada } : c)),
    )
  }

  // La cita se borró: sale de la lista.
  function quitar(citaID) {
    setCitas((prev) => prev.filter((c) => c.citaID !== citaID))
  }

  if (cargando) return <p className="text-cream-200/70">Cargando citas…</p>
  if (error) return <p className="text-red-400">{error}</p>

  return <ListaCitas citas={citas} modo="equipo" onCambio={actualizar} onEliminar={quitar} />
}
