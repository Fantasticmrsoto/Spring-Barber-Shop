import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Recuperar from './pages/Recuperar'
import Reservar from './pages/Reservar'
import CitaPublica from './pages/CitaPublica'
import MisCitas from './pages/MisCitas'
import PagarCita from './pages/PagarCita'
import Perfil from './pages/Perfil'
import PanelBarbero from './pages/PanelBarbero'
import PanelAdmin from './pages/admin/PanelAdmin'
import NotFound from './pages/NotFound'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/recuperar" element={<Recuperar />} />

          {/* Reservar y gestionar por código son públicos: no exigen cuenta. */}
          <Route path="/reservar" element={<Reservar />} />
          <Route path="/cita/:codigo" element={<CitaPublica />} />

          <Route
            path="/mis-citas"
            element={
              <ProtectedRoute>
                <MisCitas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <Perfil />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pagar/:citaID"
            element={
              <ProtectedRoute>
                <PagarCita />
              </ProtectedRoute>
            }
          />
          <Route
            path="/barbero"
            element={
              <ProtectedRoute roles={['barbero']}>
                <PanelBarbero />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['administrador']}>
                <PanelAdmin />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
