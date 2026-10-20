import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `host: true` deja el servidor escuchando en 0.0.0.0, necesario para
    // abrir la web desde el móvil usando la IP de la red local.
    host: true,
    port: 5173,
    // `strictPort` evita el salto automático al siguiente puerto libre: si
    // 5173 ya está ocupado la consola lo dice y se para, en lugar de
    // levantar una segunda copia en 5174 sin avisar.
    strictPort: true,
    // Proxy hacia la API. En desarrollo la web llama a la API por su
    // URL completa, pero tener `/api` reenviado permite probar la build de
    // producción en local (`npm run preview`) igual que en producción, donde
    // la API cuelga del mismo dominio.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
