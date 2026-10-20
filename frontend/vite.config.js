import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `host: true` deja el servidor escuchando en 0.0.0.0, necesario para
    // abrir la web desde el movil usando la IP de la red local.
    host: true,
    port: 5173,
    // `strictPort` evita el salto automatico al siguiente puerto libre: si
    // 5173 ya esta ocupado la consola lo dice y se para, en lugar de
    // levantar una segunda copia en 5174 sin avisar.
    strictPort: true,
  },
})
