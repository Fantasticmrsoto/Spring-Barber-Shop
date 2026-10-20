# Frontend — Spring Barber Shop

Web de Spring Barber Shop: React + Vite + Tailwind CSS, con diseño adaptable a
móvil.

## Comandos

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173 (escucha en 0.0.0.0)
npm run build    # build de producción en dist/
npm run lint     # Oxlint
npm run preview  # sirve la build de producción
```

## Configuración

Todo funciona sin variables de entorno: la URL de la API se deduce del host
con el que se sirvió la web (`http://<host>:3000`), de modo que la app
responde igual en el PC y en el móvil aunque cambie la IP del equipo.

Si necesitas apuntar a otro backend, copia `frontend/.env.example` a
`frontend/.env` y define `VITE_API_URL`.

## Documentación

La API está documentada en [`../documentacion/API.md`](../documentacion/API.md).
Las instrucciones generales del proyecto están en el [README raíz](../README.md).
