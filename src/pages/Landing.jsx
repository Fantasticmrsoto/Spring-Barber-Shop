import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Servicios from '../components/Servicios'
import Barberos from '../components/Barberos'
import Footer from '../components/Footer'
import WhatsAppFab from '../components/WhatsAppFab'

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar />
      <main>
        <Hero />
        <Servicios />
        <Barberos />
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  )
}
