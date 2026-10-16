import { useState } from 'react'
import AppHeader from '../../components/AppHeader'
import AdminResumen from './AdminResumen'
import AdminCitas from './AdminCitas'
import AdminNuevaCita from './AdminNuevaCita'
import AdminUsuarios from './AdminUsuarios'
import AdminServicios from './AdminServicios'
import AdminBarberos from './AdminBarberos'
import AdminHorarios from './AdminHorarios'
import AdminTransacciones from './AdminTransacciones'
import AdminResenas from './AdminResenas'

const pestanas = [
  'Resumen',
  'Citas',
  'Nueva cita',
  'Usuarios',
  'Servicios',
  'Barberos',
  'Horarios',
  'Reseñas',
  'Pagos',
]

export default function PanelAdmin() {
  const [pestana, setPestana] = useState('Resumen')

  return (
    <div className="min-h-screen bg-ink-950">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
          Panel de administración
        </h1>

        <div className="mt-6 flex flex-wrap gap-2">
          {pestanas.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPestana(p)}
              className={`rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wider transition ${
                pestana === p
                  ? 'bg-gold-500 text-ink-950'
                  : 'border border-white/15 text-cream-200 hover:border-gold-400'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {pestana === 'Resumen' && <AdminResumen />}
          {pestana === 'Citas' && <AdminCitas />}
          {pestana === 'Nueva cita' && <AdminNuevaCita />}
          {pestana === 'Usuarios' && <AdminUsuarios />}
          {pestana === 'Servicios' && <AdminServicios />}
          {pestana === 'Barberos' && <AdminBarberos />}
          {pestana === 'Horarios' && <AdminHorarios />}
          {pestana === 'Reseñas' && <AdminResenas />}
          {pestana === 'Pagos' && <AdminTransacciones />}
        </div>
      </div>
    </div>
  )
}
