import logo from '../assets/logo-spring.jpg'
import { CONTACTO } from '../config'

const ANIO = new Date().getFullYear()

export default function Footer() {
  return (
    <footer
      id="contacto"
      className="border-t border-white/10 bg-ink-950"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-5 sm:py-12">
        <div>
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Spring Barber Shop"
              className="h-16 w-16 rounded-full object-cover shadow-md shadow-black/40 sm:h-20 sm:w-20"
            />
          </div>
          <p className="mt-4 text-sm text-cream-200/70">
            Reserva en línea, llega y siéntate. El resto lo hacemos nosotros.
          </p>
        </div>

        <div>
          <h3 className="font-display text-sm uppercase tracking-widest text-gold-400">
            Horario
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-cream-200/70">
            <li>Lunes a viernes · 9:00 – 19:00</li>
            <li>Sábado · 9:00 – 17:00</li>
            <li>Domingo · cerrado</li>
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm uppercase tracking-widest text-gold-400">
            Contacto
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-cream-200/70">
            <li>{CONTACTO.direccion}</li>
            <li>{CONTACTO.telefonoVisible}</li>
            <li>{CONTACTO.correo}</li>
            <li>
              <a
                href={CONTACTO.mapaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-400 transition hover:text-gold-300"
              >
                Ver ubicación en Google Maps
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs uppercase tracking-wider text-cream-200/40">
        © {ANIO} Spring Barber Shop
      </div>
    </footer>
  )
}
