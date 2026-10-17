import { useEffect, useState } from 'react'
import { getBarberos } from '../../api/barberos'
import { getServiciosDeBarbero } from '../../api/barberoServicios'
import { getUsuarios } from '../../api/usuarios'
import { crearCita } from '../../api/citas'
import { mensajeDeError } from '../../api/client'
import { precio, duracion } from '../../utils/formato'
import { inputClase, botonPrimario, etiqueta, tarjeta } from '../../ui/estilos'

const VACIO = {
  barberoID: '',
  servicioID: '',
  fecha: '',
  hora: '',
  tipo: 'registrado',
  clienteID: '',
  nombre: '',
  telefono: '',
}

export default function AdminNuevaCita() {
  const [barberos, setBarberos] = useState([])
  const [clientes, setClientes] = useState([])
  const [servicios, setServicios] = useState([])
  const [serviciosDe, setServiciosDe] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([getBarberos(), getUsuarios()])
      .then(([bs, us]) => {
        if (!activo) return
        setBarberos(bs.filter((b) => b.estado))
        setClientes(us.filter((u) => u.rol === 'cliente'))
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
    return () => {
      activo = false
    }
  }, [])

  // Los servicios dependen del barbero elegido.
  useEffect(() => {
    if (!form.barberoID) return
    let activo = true
    getServiciosDeBarbero(form.barberoID)
      .then((s) => {
        if (!activo) return
        setServicios(s)
        setServiciosDe(form.barberoID)
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
    return () => {
      activo = false
    }
  }, [form.barberoID])

  function cambio(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value, ...(name === 'barberoID' ? { servicioID: '' } : {}) }))
  }

  async function enviar(e) {
    e.preventDefault()
    setError(null)
    setAviso(null)

    if (!form.barberoID || !form.servicioID || !form.fecha || !form.hora) {
      setError('Elige barbero, servicio, fecha y hora')
      return
    }
    if (form.tipo === 'registrado' && !form.clienteID) {
      setError('Elige un cliente registrado o cambia a "Invitado"')
      return
    }
    if (form.tipo === 'invitado' && (!form.nombre.trim() || form.telefono.replace(/\D/g, '').length < 7)) {
      setError('Indica el nombre y un teléfono de al menos 7 dígitos del invitado')
      return
    }

    const payload = {
      barberoID: Number(form.barberoID),
      servicioID: Number(form.servicioID),
      fecha_hora: `${form.fecha}T${form.hora}:00`,
    }
    if (form.tipo === 'registrado') {
      payload.clienteID = Number(form.clienteID)
    } else {
      payload.contacto_nombre = form.nombre.trim()
      payload.contacto_telefono = form.telefono.trim()
    }

    setEnviando(true)
    try {
      const cita = await crearCita(payload)
      setAviso(`Cita #${cita.citaID} agendada para el ${cita.fecha_inicio.replace('T', ' ')}.`)
      setForm((f) => ({ ...VACIO, barberoID: f.barberoID, servicioID: f.servicioID, fecha: f.fecha }))
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const servicio = serviciosDe === form.barberoID
    ? servicios.find((s) => String(s.serviciosID) === String(form.servicioID))
    : null
  const serviciosVisibles = form.barberoID && serviciosDe === form.barberoID ? servicios : []

  return (
    <form onSubmit={enviar} className={`${tarjeta} max-w-2xl p-5`}>
      <h2 className="font-display text-sm uppercase tracking-widest text-gold-400">
        Reserva manual
      </h2>
      <p className="mt-1 text-xs text-cream-200/50">
        Agenda una cita para un cliente registrado o para alguien que llega sin cuenta.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={etiqueta}>
          Barbero
          <select name="barberoID" required value={form.barberoID} onChange={cambio} className={`mt-2 ${inputClase}`}>
            <option value="">Elige un barbero…</option>
            {barberos.map((b) => (
              <option key={b.barberoID} value={b.barberoID}>
                {b.nombre} {b.apellido}
              </option>
            ))}
          </select>
        </label>

        <label className={etiqueta}>
          Servicio
          <select
            name="servicioID"
            required
            value={form.servicioID}
            onChange={cambio}
            disabled={!form.barberoID}
            className={`mt-2 ${inputClase} disabled:opacity-50`}
          >
            <option value="">{form.barberoID ? 'Elige un servicio…' : 'Elige un barbero primero'}</option>
            {serviciosVisibles.map((s) => (
              <option key={s.serviciosID} value={s.serviciosID}>
                {s.nombre} · {precio(s.precio)}
              </option>
            ))}
          </select>
        </label>

        <label className={etiqueta}>
          Fecha
          <input type="date" name="fecha" required value={form.fecha} onChange={cambio} className={`mt-2 ${inputClase}`} />
        </label>

        <label className={etiqueta}>
          Hora
          <input type="time" name="hora" required value={form.hora} onChange={cambio} className={`mt-2 ${inputClase}`} />
        </label>
      </div>

      {servicio && (
        <p className="mt-2 text-xs text-cream-200/50">
          Duración {duracion(servicio.duracion_minutos)} · terminaría según el horario del barbero.
        </p>
      )}

      <div className="mt-5">
        <span className={etiqueta}>¿Para quién es la cita?</span>
        <div className="mt-2 flex gap-2">
          {[
            { valor: 'registrado', texto: 'Cliente registrado' },
            { valor: 'invitado', texto: 'Invitado (walk-in)' },
          ].map((op) => (
            <button
              key={op.valor}
              type="button"
              onClick={() => setForm((f) => ({ ...f, tipo: op.valor }))}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                form.tipo === op.valor
                  ? 'bg-gold-500 text-ink-950'
                  : 'border border-white/15 text-cream-200 hover:border-gold-400'
              }`}
            >
              {op.texto}
            </button>
          ))}
        </div>
      </div>

      {form.tipo === 'registrado' ? (
        <label className={`mt-4 ${etiqueta}`}>
          Cliente
          <select name="clienteID" value={form.clienteID} onChange={cambio} className={`mt-2 ${inputClase}`}>
            <option value="">Elige un cliente…</option>
            {clientes.map((c) => (
              <option key={c.usuarioID} value={c.usuarioID}>
                {c.nombre} {c.apellido} · {c.telefono}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={etiqueta}>
            Nombre del invitado
            <input name="nombre" value={form.nombre} onChange={cambio} className={`mt-2 ${inputClase}`} />
          </label>
          <label className={etiqueta}>
            Teléfono
            <input name="telefono" value={form.telefono} onChange={cambio} className={`mt-2 ${inputClase}`} placeholder="300 000 0000" />
          </label>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {aviso && <p className="mt-4 text-sm text-emerald-300">{aviso}</p>}

      <button type="submit" disabled={enviando} className={`mt-5 ${botonPrimario}`}>
        {enviando ? 'Agendando…' : 'Agendar cita'}
      </button>
    </form>
  )
}
