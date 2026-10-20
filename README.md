# Spring Barber Shop

Proyecto fullstack de la peluquería: API REST en Express + PostgreSQL y web en
React + Vite + Tailwind CSS.

## Estructura

```
barberia/
├── backend/          API REST (Express, JWT, PostgreSQL) y migraciones
├── frontend/         Web (React + Vite + Tailwind)
├── documentacion/    Documentación de la API
├── postman/          Colección de Postman usada por la suite E2E
└── baseDeDatos_scrip/ Scripts SQL de la base de datos
```

## Puesta en marcha

```bash
# 1. Instalar dependencias de la API y de la web
npm run install:all

# 2. Configurar la base de datos
cp backend/.env.example backend/.env
npm run migrate

# 3. Levantar la API (puerto 3000) en una terminal
npm run dev:api

# 4. Levantar la web (puerto 5173) en otra terminal
npm run dev
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run install:all` | Instala dependencias de `backend/` y `frontend/` |
| `npm run dev` | Levanta la web en modo desarrollo (puerto 5173) |
| `npm run dev:api` | Levanta la API (puerto 3000) |
| `npm run migrate` | Aplica las migraciones de la base de datos |
| `npm run build` | Genera la build de producción de la web |
| `npm run lint` | Ejecuta Oxlint sobre el frontend |

## Abrir la web desde el móvil

La web se sirve en `0.0.0.0:5173`, así que es accesible desde cualquier
dispositivo de la red local:

```bash
hostname -I   # muestra la IP del equipo, por ejemplo 192.168.0.251
```

Con esa IP, en el navegador del móvil:

```
http://192.168.0.251:5173
```

Detalles a tener en cuenta:

- El móvil debe estar en la **misma red WiFi** que el equipo.
- La URL de la API se deduce sola del host con el que se sirvió la web
  (`http://<misma-IP>:3000`), así que no hay que editar nada cuando la IP del
  equipo cambia. Si aun así quieres fijarla, define `VITE_API_URL` en
  `frontend/.env` (plantilla en `frontend/.env.example`).
- Si el router tiene activado el **aislamiento de clientes** (AP isolation) o
  usas una red de invitados, el móvil no alcanzará el equipo.
- El puerto 5173 es estricto: si ya está ocupado, Vite avisa en consola y se
  detiene en lugar de arrancar una segunda copia en otro puerto.

## Pruebas E2E

El workflow `.github/workflows/newman.yml` levanta PostgreSQL, aplica las
migraciones y ejecuta la colección de Postman con Newman en cada push a
`main`/`master`.
