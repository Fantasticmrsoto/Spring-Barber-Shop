# Spring Barber Shop

Plataforma SaaS de agendamiento y gestión operativa para barberías. El repositorio incluye una **API RESTful** (backend) y una **interfaz web** (frontend) para gestionar clientes, personal, catálogo de servicios, agendamiento de citas sin colisiones, reseñas de clientes y el **cobro de las citas** (pago móvil con comprobante, o efectivo/tarjeta registrados por el administrador).

## 🚀 Tecnologías y Arquitectura

El sistema está construido bajo el patrón de diseño **MVC** (Modelo-Vista-Controlador) orientado a APIs.

**Backend**

*   **Entorno:** Node.js
*   **Framework:** Express.js
*   **Base de Datos:** PostgreSQL (paquete `pg` con Pool de conexiones)
*   **Seguridad:** Autenticación Stateless con JSON Web Tokens (JWT) y cifrado de contraseñas con `bcryptjs`
*   **Subida de archivos:** `multer` (fotos de barbero y comprobantes de pago)

**Frontend**

*   **Librería:** React 19
*   **Bundler / Dev server:** Vite
*   **Estilos:** Tailwind CSS
*   **Ruteo:** React Router
*   **Cliente HTTP:** Axios

## 📋 Prerrequisitos

*   [Node.js](https://nodejs.org/) **v18 o superior** — Express 5 lo exige; con Node 16 el proyecto no arranca
*   [PostgreSQL](https://www.postgresql.org/) v13 o superior
*   Git

## 🔧 Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/yhonaikermedinagarcia-a11y/spring_barber_shop.git
cd spring_barber_shop/backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar las variables de entorno

```bash
cp .env.example .env
```

`.env.example` trae `cambiar_esto` como valor de la contraseña y del secreto JWT.
**No sirve tal cual**: hay que editar dos líneas antes de seguir.

```bash
# En .env sustituye:
#   DB_PASSWORD=cambiar_esto   ->  la contraseña real de tu usuario de PostgreSQL
#   JWT_SECRET=cambiar_esto   ->  una cadena larga y aleatoria
# Genera una con: openssl rand -hex 32
```

| Variable | Por defecto | Descripción |
|---|---|---|
| `DB_HOST` | `localhost` | Host de PostgreSQL |
| `DB_PORT` | `5432` | Puerto de PostgreSQL |
| `DB_NAME` | `barberia` | Nombre de la base de datos |
| `DB_USER` | `postgres` | Usuario de PostgreSQL |
| `DB_PASSWORD` | — | Contraseña (**obligatoria**) |
| `JWT_SECRET` | — | Secreto para firmar los tokens (**obligatorio**) |
| `PORT` | `3000` | Puerto donde escucha la API |

El nombre de la base debe ser **el mismo** en `.env` y en el paso 4. Si cambias
`DB_NAME`, cambia también el `CREATE DATABASE`.

### 4. Crear la base de datos

```bash
# El nombre debe coincidir con DB_NAME de tu .env
psql -U postgres -c "CREATE DATABASE barberia;"
```

Si ya existe, PostgreSQL avisa y no pasa nada. En Windows, `psql` suele estar en
`C:\Program Files\PostgreSQL\<versión>\bin` y quizá no esté en el PATH.

### 5. Aplicar las migraciones

```bash
npm run migrate
```

Crea el esquema completo. **Paso obligatorio**: sin él el servidor arranca pero todas
las peticiones devuelven `500` con `relation does not exist`.

```
Aplicando 12 de 12 migraciones:
  000_esquema_base.sql ... ok
  ...
  011_modulo_pagos.sql ... ok
12 migración(es) aplicada(s).
```

Para consultar el estado: `npm run migrate:status`.

#### Cargar datos de demostración (opcional)

Recién migrada, la base está **vacía**: no hay administrador, ni servicios, ni
barberos, así que la landing sale en blanco y no se puede reservar. Para dejarla
poblada y poder probar todo enseguida:

```bash
npm run seed
```

Crea (de forma **idempotente**, no borra nada) un administrador, un cliente de
ejemplo, tres barberos con su perfil público, seis servicios, la relación
barbero↔servicio y un horario de lunes a sábado de 09:00 a 18:00. Si vuelves a
ejecutarlo no duplica nada.

```
  Datos de demostración listos:

    Usuarios nuevos:            5
    Servicios nuevos:           6
    Barberos nuevos:            3
    Servicios por barbero:      18
    Franjas de horario:         18

  Acceso de administrador:
    correo:     admin@springbarber.com
    contraseña: Admin123

  Acceso de cliente:
    correo:     cliente@springbarber.com
    contraseña: Cliente123
```

> Son credenciales de ejemplo, **cámbialas antes de usarlas en producción**. Para
> partir de cero otra vez, recrea una base vacía y repite `npm run migrate`.

### 6. Arrancar el servidor

```bash
npm start
```

Si todo está correcto:

```
✅ Conexión exitosa a PostgreSQL (Base de datos: barberia)
🚀 Servidor corriendo en http://localhost:3000
```

### 7. Comprobar que funciona

```bash
curl http://localhost:3000/
```

O abre `postman/My Collection.postman_collection.json` en Postman y pulsa **Run**.
Si los 30 pasos y 53 aserciones quedan en verde, el backend está correcto.

### 8. Levantar la interfaz web (opcional)

La interfaz vive en `frontend/` y consume la API del backend. Necesita que el backend
esté corriendo en `http://localhost:3000`.

```bash
cd ../frontend
npm install
npm run dev
```

Queda disponible en **http://localhost:5173**. Para generar el build de producción:
`npm run build` (salida en `frontend/dist/`).

## ⚠️ Si algo falla

El servidor **no arranca** si no puede conectarse a PostgreSQL, y el error indica qué
variable revisar:

```
❌ No se pudo conectar con PostgreSQL
   password authentication failed for user "postgres"

   Revisa backend/.env:
     DB_HOST=localhost
     DB_PORT=5432
     DB_NAME=barberia
     DB_USER=postgres
```

| Síntoma | Causa habitual |
|---|---|
| `password authentication failed` | `DB_PASSWORD` incorrecta |
| `database "X" does not exist` | Falta crear la base (paso 4), o `DB_NAME` no coincide |
| `ECONNREFUSED` | PostgreSQL no está corriendo |
| `Falta la variable de entorno JWT_SECRET` | No se editó `JWT_SECRET` en el paso 3 |
| Todo devuelve `500` con `relation does not exist` | Saltó el paso 5, `npm run migrate` |

## 🗄️ Esquema de Base de Datos

El núcleo opera sobre 8 entidades con integridad referencial estricta y restricciones UNIQUE y CHECK:

| Entidad | Descripción |
|---|---|
| `usuario` | Autenticación y roles |
| `barbero` | Perfiles operativos (incluye datos públicos: descripción, especialidad, Instagram, teléfono y foto) |
| `servicios` | Catálogo de prestaciones |
| `cita` | Eje transaccional de agendamiento (admite citas de invitado sin cuenta) |
| `horario_laboral` | Gestión de jornadas y turnos |
| `barbero_servicio` | Relación dinámica de habilidades del personal |
| `resena` | Calificaciones (medias estrellas) y comentarios de clientes sobre barberos |
| `transacciones` | Cobro de las citas: pago móvil con comprobante, o efectivo/tarjeta en local |

### Migraciones

El esquema se construye aplicando en orden los archivos `.sql` de `backend/migrations/`. El registro de cuáles se aplicó vive en la tabla `schema_migrations`.

```bash
npm run migrate:status   # ver cuáles faltan
npm run migrate          # aplicar las pendientes
```

Las migraciones son idempotentes: se pueden reaplicar sin efectos duplicados. Para reconstruir el esquema desde cero basta con crear una base vacía y ejecutar `npm run migrate`.

| # | Archivo | Qué hace |
|---|---|---|
| 000 | `000_esquema_base.sql` | Crea las 7 tablas con sus constraints |
| 001 | `001_agregar_estado_cita.sql` | Agrega `cita.estado` y su CHECK |
| 002 | `002_llaves_foraneas.sql` | Agrega las 8 llaves foráneas |
| 003 | `003_constraints_unique.sql` | `UNIQUE` en `usuario.correo` y `barbero.usuarioID` |
| 004 | `004_modulo_horario_laboral.sql` | `UNIQUE` y CHECKs de `horario_laboral` |
| 005 | `005_modulo_barbero_servicio.sql` | `UNIQUE` del par en `barbero_servicio` |
| 006 | `006_modulo_transacciones.sql` | `fecha_creacion` con `DEFAULT now()` y `NOT NULL` |
| 007 | `007_perfil_barbero.sql` | Perfil público del barbero: descripción, especialidad, Instagram, teléfono y foto |
| 008 | `008_cita_invitado.sql` | `cita.clienteID` opcional + `contacto_nombre`/`contacto_telefono` para citas de invitado |
| 009 | `009_modulo_resena.sql` | Tabla `resena` (calificación + comentario por cliente y barbero) |
| 010 | `010_resena_media_estrella.sql` | `resena.calificacion` a `numeric(2,1)`: admite medias estrellas (0.5–5.0) |
| 011 | `011_modulo_pagos.sql` | Extiende `transacciones` con `estado`, `metodo`, `comprobante`, `citaID` y `motivo_rechazo` |

### Aplicación manual (opcional)

Si prefieres no usar el runner, puedes aplicar los archivos en orden desde `psql`:

```bash
psql -U postgres -d spring_barber_shop \
  -f backend/migrations/000_esquema_base.sql \
  -f backend/migrations/001_agregar_estado_cita.sql \
  -f backend/migrations/002_llaves_foraneas.sql \
  -f backend/migrations/003_constraints_unique.sql \
  -f backend/migrations/004_modulo_horario_laboral.sql \
  -f backend/migrations/005_modulo_barbero_servicio.sql \
  -f backend/migrations/006_modulo_transacciones.sql \
  -f backend/migrations/007_perfil_barbero.sql \
  -f backend/migrations/008_cita_invitado.sql \
  -f backend/migrations/009_modulo_resena.sql \
  -f backend/migrations/010_resena_media_estrella.sql \
  -f backend/migrations/011_modulo_pagos.sql
```

## 📡 Endpoints Principales

Todas las respuestas de la API utilizan un formato JSON estandarizado: `{ "ok": true/false, ...data }`.

| Módulo | Endpoint | Método | Protección | Descripción |
|---|---|---|---|---|
| Auth | `/api/auth/login` | POST | Pública | Inicia sesión y retorna JWT |
| Auth | `/api/auth/me` | GET | JWT | Devuelve el usuario del token |
| Auth | `/api/auth/recuperar` | POST | Pública | Restablece la contraseña |
| Usuarios | `/api/usuarios` | GET, POST, PUT, DELETE | Pública/JWT | CRUD de clientes y empleados |
| Usuarios | `/api/usuarios/perfil` | PUT | JWT | Actualiza el perfil propio |
| Servicios | `/api/servicios` | GET, POST, PUT, DELETE | Pública/JWT | Catálogo de prestaciones |
| Barberos | `/api/barberos` | GET, POST, PUT | Pública/JWT | Personal operativo (incluye perfil público) |
| Barberos | `/api/barberos/:id/foto` | POST | Barbero/Admin | Sube la foto de perfil (multipart) |
| Reseñas | `/api/barberos/:id/resenas` | GET, POST | Pública/JWT | Lista / crea reseñas de un barbero (medias estrellas) |
| Reseñas | `/api/barberos/resenas` | GET | Admin | Lista todas las reseñas |
| Reseñas | `/api/barberos/resenas/:resenaID` | DELETE | Admin | Elimina (modera) una reseña |
| Horarios | `/api/horarios` | GET, POST, DELETE | Barbero/Admin | Configura la jornada laboral |
| Citas | `/api/citas` | GET, POST | Autenticado | Lista / crea citas validando disponibilidad y horario |
| Citas | `/api/citas/:id` | PUT | Admin/Cliente | Reprograma (cambia fecha/hora) una cita |
| Citas | `/api/citas/:id/estado` | PUT | Autenticado | Modifica el estado (pendiente, completada, cancelada…) |
| Citas | `/api/citas/publica` | POST | Pública | Reserva de invitado sin cuenta; devuelve un código |
| Citas | `/api/citas/publica/:codigo` | GET, PUT | Pública | Consulta o cancela una reserva por su código |
| Citas | `/api/citas/ocupados` | GET | Pública | Franjas ocupadas para el calendario |
| B-Servicio | `/api/barbero-servicios` | GET, POST, DELETE | Barbero/Admin | Asigna o desvincula servicios a un barbero |
| Pagos | `/api/transacciones` | GET, POST | Admin/Cliente | Lista y registra pagos (pago móvil con comprobante) |
| Pagos | `/api/transacciones/:id` | GET | Admin/Cliente | Consulta un pago |
| Pagos | `/api/transacciones/:id/aprobar` | PUT | Admin | Aprueba un pago móvil pendiente |
| Pagos | `/api/transacciones/:id/rechazar` | PUT | Admin | Rechaza un pago indicando el motivo |
| Estadísticas | `/api/estadisticas/resumen` | GET | Admin | Métricas del dashboard |

> El contrato completo (cuerpos, validaciones y ejemplos) está en [`documentacion/API.md`](documentacion/API.md).

### Pagos

Cada cita se cobra con una fila en `transacciones`, ligada por `citaID`:

*   **Pago móvil** (`metodo_pago: "pago_movil"`): el cliente sube un **comprobante**
    (imagen JPG/PNG/WEBP/GIF, máximo 5 MB) en el campo `comprobante` y una referencia;
    el pago queda **`pendiente`** hasta que un administrador lo **aprueba** o **rechaza**.
*   **Efectivo / tarjeta** (`metodo_pago: "efectivo"` o `"tarjeta"`): los registra el
    **administrador** en el local y quedan **`completado`** de inmediato.

Reglas: un cliente solo puede pagar **sus propias citas** (y no una `cancelada`); un
cliente solo puede usar `pago_movil`; si ya existe un pago vigente para la cita, un
nuevo intento responde `409`; tras un rechazo se puede reintentar. El `monto` es
opcional y por defecto toma el `precio` del servicio.

> **Importante al subir el comprobante:** la petición va como `multipart/form-data` y
> hay que **no** forzar `Content-Type: application/json` (axios descartaría el archivo).
> El servidor guarda los archivos en `backend/uploads/`.

### Flujo de autenticación

Todas las rutas protegidas esperan el token en el header `Authorization: Bearer <token>`.

> **Ojo con el nombre del campo de la contraseña.** En `POST /api/usuarios` el campo
> histórico es `clave`, aunque **`password` también funciona** (se acepta cualquiera de
> los dos). En `POST /api/auth/login` el campo es `password`. Ningún otro endpoint recibe
> contraseña. Todos los campos marcados como obligatorios en la tabla siguiente deben
> enviarse o la respuesta es `400`.

```bash
# 1. Crear un usuario (o usar uno existente).
#    Obligatorios: nombre, apellido, correo, telefono, clave (o password)
curl -X POST http://localhost:3000/api/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Admin","apellido":"Principal","correo":"admin@barberia.com","telefono":"3000000000","clave":"secreto123","rol":"administrador"}'

# 2. Login → retorna JWT
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@barberia.com","password":"secreto123"}'

# Respuesta:
# {
#   "ok": true,
#   "token": "eyJhbGciOi...",
#   "expiresIn": "8h",
#   "usuario": { "usuarioID": 1, "nombre": "Admin", "apellido": "Principal",
#                "correo": "admin@barberia.com", "rol": "administrador" }
# }

# 3. Averiguar quién está autenticado (imprescindible al recargar la página)
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer eyJhbGciOi..."

# 4. Usar el token en rutas protegidas
curl http://localhost:3000/api/citas \
  -H "Authorization: Bearer eyJhbGciOi..."
```

**Sobre la sesión:** el token dura 8 horas (`expiresIn`). No hay endpoint de refresh ni
de logout, así que el frontend debe:

- guardarlo (localStorage o similar) y adjuntarlo en cada petición protegida;
- limpiarlo al expirar o ante un `401`, y volver a pedir credenciales;
- usar `GET /api/auth/me` al arrancar para saber si la sesión sigue viva.

### Crear el primer administrador

El sistema requiere al menos un usuario con rol `administrador` para gestionar citas y transacciones. Crea uno antes de iniciar operaciones:

```bash
curl -X POST http://localhost:3000/api/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Admin","apellido":"Principal","correo":"admin@barberia.com","telefono":"3000000000","clave":"cambia-esto","rol":"administrador"}'
```

Luego inicia sesión con ese usuario para obtener el token de administrador.

> Atajo: `npm run seed` (ver arriba) crea un administrador `admin@springbarber.com`
> / `Admin123` junto con servicios, barberos y horarios de demostración.

## 📁 Estructura del Proyecto

```
backend/
├── migrations/           # Archivos SQL idempotentes (000–011)
├── scripts/
│   ├── migrate.js        # Runner de migraciones
│   └── seed.js           # Datos de demostración (npm run seed)
├── src/
│   ├── config/           # db.js (Pool pg), jwt.js (firma/verificación), upload.js (multer)
│   ├── controllers/      # Lógica de cada módulo
│   ├── middlewares/      # authMiddleware.js (verificación JWT)
│   ├── routes/           # Definición de rutas por módulo
│   └── app.js            # Punto de entrada, montaje de middlewares
├── uploads/              # Fotos de barbero y comprobantes de pago (ignorado por git)
├── .env.example          # Plantilla de variables de entorno
├── .env                  # Credenciales locales (ignorado por git)
└── package.json

frontend/
├── src/
│   ├── api/              # Clientes axios por módulo
│   ├── components/       # Componentes reutilizables
│   ├── pages/            # Vistas (públicas, cliente, barbero y admin/)
│   ├── ui/               # Estilos base y primitivos
│   └── App.jsx           # Ruteo de la SPA
└── package.json

postman/                  # Colección E2E
documentacion/API.md      # Contrato detallado de la API
```

## ⚠️ Manejo de Errores

Formato de respuesta exitosa:
```json
{ "ok": true, "data": { ... } }
```

Formato de respuesta con error:
```json
{ "ok": false, "error": "Credenciales inválidas" }
```

Errores comunes:

| Código | Significado |
|---|---|
| `400` | Solicitud inválida o conflicto de negocio (datos faltantes, correo duplicado, barbero repetido, cita solapada o fuera de horario) |
| `401` | No autenticado (token ausente o inválido) |
| `403` | Prohibido (rol insuficiente) |
| `404` | Ruta o recurso inexistente |
| `429` | Demasiados intentos de acceso a `/api/auth/login` |
| `500` | Error interno del servidor |

> **Nota:** Las rutas no encontradas están manejadas globalmente y retornan un error 404 Not Found en formato JSON.

### Limitación de intentos de acceso

`POST /api/auth/login` acepta **10 intentos fallidos por IP cada 15 minutos**; a partir
del siguiente responde `429`. Solo se cuentan los fallos: un login correcto no suma y
además reinicia el contador, de modo que quien se equivoca unas veces y luego entra
bien no arrastra el presupuesto. La respuesta incluye las cabeceras `RateLimit` y
`Retry-After`.

Dos cosas que conviene tener presentes al desplegar:

- **Si hay un proxy o balanceador delante**, hay que configurar `trust proxy` en
  `app.js`. Sin eso todas las peticiones parecen venir de la misma IP y el límite se
  agota de golpe para todos los usuarios.
- **Con varias réplicas**, el contador vive en la memoria de cada proceso, así que el
  límite real se multiplica por el número de servidores. La solución es un almacén
  compartido (Redis).

## Pruebas E2E

La colección de Postman (`postman/My Collection.postman_collection.json`) recorre
los 8 módulos con 30 peticiones y 53 aserciones: el flujo completo, los 401 sin
token, los 403 por rol insuficiente, los 400 de validación, los 404 y los casos de
conflicto (correo duplicado, barbero repetido, cita solapada, cita fuera de
horario).

Las fechas se calculan en el pre-request de la colección a partir del día actual, de
modo que siempre agenda el próximo lunes a las 10:00 dentro del horario configurado
y la suite no caduca con el paso del tiempo. Los correos llevan `{{$timestamp}}` y
`{{$randomInt}}`, así que la colección se puede reejecutar sobre la misma base.

```bash
# terminal 1: base de datos de pruebas y servidor
cd backend
DB_NAME=e2e_local npm run migrate
DB_NAME=e2e_local JWT_SECRET=local npm start

# terminal 2: la colección
npx newman run "postman/My Collection.postman_collection.json" \
  --env-var "base_url=http://localhost:3000"
```

En GitHub Actions corre sola en cada push y pull request: levanta PostgreSQL, aplica
las migraciones, espera a que la API responda antes de probar y publica el informe
HTML como artefacto aunque la suite falle.
