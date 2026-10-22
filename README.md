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

### Qué URL abrir

| URL | Qué se ve |
|---|---|
| `http://localhost:5173` | La web en modo desarrollo (Vite). Es la que se usa mientras se toca el código: recarga al instante. |
| `http://localhost:3000` | La API. Su raíz devuelve el JSON con el estado del servidor. Si además existe `frontend/dist` y está activado `SERVE_FRONTEND=true` en `backend/.env`, en `:3000` se sirve **la web ya compilada**, igual que en producción, y la API queda en `/api`. |
| `http://192.168.0.251:5173` | La web desde el móvil, en la red local. |

Lo normal en desarrollo es trabajar en `:5173`. Para probar la web compilada
—que es lo que se despliega— basta con `npm run build` y tener
`SERVE_FRONTEND=true` en `backend/.env`: la API sirve la web y la API en el
mismo origen, sin tocar `VITE_API_URL`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run install:all` | Instala dependencias de `backend/` y `frontend/` |
| `npm run dev` | Levanta la web en modo desarrollo (puerto 5173) |
| `npm run dev:api` | Levanta la API (puerto 3000) |
| `npm run migrate` | Aplica las migraciones de la base de datos |
| `npm run build` | Genera la build de producción de la web |
| `npm run lint` | Ejecuta Oxlint sobre el frontend |

## Imágenes y vídeo

Las imágenes y el vídeo de la portada ya están optimizados y viven en
`frontend/src/assets/`:

| Fichero | Peso | Para qué sirve |
|---|---|---|
| `video/inicio.mp4` | 5,2 MB | Vídeo de la portada (H.264, sin audio, con el índice al principio para que empiece a reproducirse sin esperar) |
| `video/poster.avif` / `.webp` | 16 KB / 27 KB | Fotograma del vídeo, lo que se ve mientras carga |
| `barberos/barb*.webp` | 1-8 KB | Fotos de referencia de los barberos |

Para que la web no se ponga más lenta:

- El vídeo **no** se descarga con la página: primero se pinta el cartel y el
  vídeo solo se pide cuando el bloque está a la vista y el navegador ya está
  libre. Si el visitante pide menos movimiento (`prefers-reduced-motion`), el
  vídeo no se descarga nunca.
- Las fotos van en WebP y en dos tamaños (96 y 192 px); con `srcset`, el
  navegador descarga solo el que le hace falta.
- `vite.config.js` lleva `assetsInlineLimit: 0`: las imágenes se emiten como
  archivos con nombre hash en vez de ir en base64 dentro del JavaScript. Así
  se cachean por separado y el paquete principal no crece.

Un detalle importante: los archivos de `assets/` se sirven con
`Cache-Control: immutable` (un año). Como el nombre lleva un hash, al cambiar
el contenido cambia la URL y el navegador pide la versión nueva; por eso hay
que **subir el fichero nuevo**, no solo sustituir el contenido.

Una foto subida desde el panel de administración manda siempre sobre la foto
de referencia.

## Cuentas de administrador

Una cuenta de administrador se puede dar de alta desde el panel, pero para
llegar al panel hace falta entrar, y para entrar hace falta una cuenta de
administrador. Para ese caso está el script, que trabaja directamente con la
base de datos y no necesita ninguna credencial previa:

```bash
npm run admin:crear -- --correo=admin@barberia.com --clave=miClave123
```

También admite `--nombre`, `--apellido`, `--telefono` y `--rol`. Si la cuenta
ya existe, no falla: le cambia la clave y el rol, así que también sirve para
recuperar el acceso.

La clave se guarda como hash bcrypt, nunca en texto plano, igual que cuando se
crea un usuario desde la web.

**Cada entorno tiene su propia base de datos** (en local es PostgreSQL, en la
nube es Neon), y una cuenta creada en uno no aparece en el otro: hay que
ejecutar el script en cada uno.

## El panel de administración

Entrando en `/admin` con una cuenta de administrador se llega al panel. Tiene
diez pestañas y desde cada una se puede hacer todo lo que la API permite:

| Pestaña | Qué se puede hacer |
|---|---|
| Resumen | Citas del día, ingresos del mes, ticket promedio, servicios más pedidos y ranking de barberos con su comisión |
| Citas | Verlas todas, filtrarlas por estado y fecha, **moverlas de día u hora** y cambiar su estado (confirmar, completar, cancelar) |
| Nueva cita | Agendar una cita para un cliente registrado o para alguien que llega sin cuenta |
| Usuarios | Crear, editar (nombre, correo, teléfono, rol y contraseña), eliminar y dar de alta barberos |
| Servicios | Crear, editar y eliminar el catálogo de servicios con su precio y duración |
| Barberos | Dar de alta barberos, editar su comisión, ficha pública y estado, **cambiar su foto** y asignarles los servicios que hacen |
| Horarios | Poner y quitar el horario laboral de cada barbero, día a día |
| Reseñas | Verlas todas, borrarlas y registrar una en nombre de un cliente |
| Pagos | Registrar un pago cobrado en el local, y aprobar o rechazar los pagos móviles con su comprobante |
| Días no laborables | Añadir y quitar feriados y días de descanso |

Dos detalles que suelen hacer falta:

- La **foto de un barbero** se cambia desde la pestaña Barberos, con el botón
  *Foto*. También puede hacerlo el propio barbero desde su panel.
- **Reprogramar** una cita (la pestaña Citas) la mueve de día y hora. Se
  comprueban las mismas reglas que al reservar: el horario del barbero, los
  días de descanso, los feriados y que no se solape con otra cita.

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

## Despliegue en la nube

Para que la web funcione desde cualquier móvil (no solo en tu wifi) hace falta
publicarla con un dominio propio. El repositorio ya viene preparado:

| Pieza | Dónde | Fichero |
|---|---|---|
| Web (React) | Vercel | `frontend/vercel.json` |
| API (Express) | Render | `Dockerfile`, `render.yaml` |
| Base de datos | Neon | `backend/src/config/dbConfig.js` |
| Dominio y DNS | Cloudflare | — |

La guía paso a paso (cuentas, DNS, variables, lista de comprobación y
problemas frecuentes) está en
**[`documentacion/DESPLIEGUE.md`](documentacion/DESPLIEGUE.md)**.

Resumen de lo que hace posible el despliegue:

- La API acepta `DATABASE_URL` (con SSL) para bases de datos gestionadas.
- `trust proxy` activo en producción: sin él, el limitador de intentos de login
  se agota para todos los usuarios a la vez, porque todas las peticiones parecen
  venir de la IP del proxy.
- Sonda de estado en `/api/salud` y cierre ordenado al recibir `SIGTERM`.
- En producción la web llama a `/api` en el mismo dominio, así que no hay CORS.
- El `Dockerfile` compila la web y la API, de forma que también se puede
  desplegar todo en un único servicio.

## Pruebas E2E

El workflow `.github/workflows/newman.yml` levanta PostgreSQL, aplica las
migraciones y ejecuta la colección de Postman con Newman en cada push a
`main`/`master`.
