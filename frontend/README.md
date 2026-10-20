# Frontend — Spring Barber Shop

Web de Spring Barber Shop: React + Vite + Tailwind CSS, con diseño adaptable a
móvil.

## Comandos

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:5173 (escucha en 0.0.0.0)
npm run build    # build de producción en dist/
npm run lint     # Oxlint
npm run preview  # sirve la build de producción con el proxy /api
```

## Configuración

Todo funciona sin variables de entorno: la URL de la API se deduce del host
con el que se sirvió la web (`http://<host>:3000`), de modo que la app
responde igual en el PC y en el móvil aunque cambie la IP del equipo.

Si necesitas apuntar a otro backend, copia `frontend/.env.example` a
`frontend/.env` y define `VITE_API_URL`.

En la build de producción la API se pide en `/api`, bajo el mismo dominio que
la web: así no hay CORS ni cookies entre sitios. En Vercel, el dominio y la
API en dominios distintos, hay que definir `VITE_API_URL` con la URL de la API.

## Iconos de la aplicación (PWA)

Los iconos PNG (`icono-192.png`, `icono-512.png`, `icono-maskable-512.png` y
`apple-touch-icon.png`) se generan a partir de la forma del favicon:

```bash
python3 scripts/generar-iconos.py
```

Son los que permiten que en el móvil aparezca el icono y el nombre "Spring
Barber Shop" al usar "Añadir a la pantalla de inicio".

## Documentación

La API está documentada en [`../documentacion/API.md`](../documentacion/API.md)
y el despliegue en la nube en
[`../documentacion/DESPLIEGUE.md`](../documentacion/DESPLIEGUE.md).
Las instrucciones generales del proyecto están en el [README raíz](../README.md).
