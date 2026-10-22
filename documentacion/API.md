# Referencia de la API

Contrato de `http://localhost:3000` para construir el frontend.

La colección de Postman (`postman/My Collection.postman_collection.json`) ejercita todo
lo de esta tabla: 61 peticiones y 111 aserciones (`pm.test` + `pm.expect`). Es la
fuente de verdad ejecutable.

```bash
# con la API levantada en local
npx newman run "postman/My Collection.postman_collection.json" \
  --env-var "base_url=http://localhost:3000" \
  --env-var "adminSemillaClave=clave123" \
  --env-var "barberoSemillaClave=clave123"
```

Las dos últimas variables son las contraseñas de las cuentas que crea el seed
(`npm run seed`): el administrador y el barbero de ejemplo. La suite entra con
ellas para probar las rutas que solo esos roles pueden usar.

---

## Rutas base

| Ruta | Qué devuelve |
|---|---|
| `GET /` | Estado de la API en JSON. En producción, si la web se sirve desde el mismo proceso, devuelve la web (ver abajo) |
| `GET /api` | Estado de la API en JSON. Siempre disponible, también en producción |
| `GET /api/salud` | Sonda de estado: `200` si la API responde **y** la base de datos está accesible, `503` si no |
| `GET /api/feriados` | Días en los que no se puede reservar (domingos y feriados) |

`/api/salud` es la ruta que usan las plataformas de hosting para comprobar el
servicio, y la que conviene usar en monitorización.

En producción la web y la API comparten dominio: la web se sirve en `/` y la API
en `/api/*`. Por eso `GET /` devuelve el `index.html` de la SPA y no un JSON.
La colección de Postman se ejecuta contra el entorno de desarrollo, donde `/`
sí devuelve el JSON de la API.

---

## Convenciones

**Formato de respuesta.** Siempre JSON con `ok`. Las de éxito incluyen `message` y el
dato; las de error, `message` o `error`.

```jsonc
// éxito
{ "ok": true, "message": "...", "total": 3, "servicios": [ ... ] }
// error
{ "ok": false, "message": "El correo electrónico ya está registrado" }
```

**Errores.** No hay campo `errors` ni validación por campo: el `message` es una frase
lista para mostrar al usuario. La API no distingue campos: o acepta o devuelve 400.

**Formato de la respuesta de error.** Los 4xx usan la clave `message`; los 5xx usan
`error`. El frontend acepta las dos (`mensajeDeError` en `src/api/client.js`).

**Errores inesperados.** Cualquier excepción que se escape de los controladores la
recoge el manejador global de `src/app.js` y se devuelve **siempre en JSON**, nunca
en HTML. Si la excepción es por un esquema sin aplicar (código `42P01` de
PostgreSQL), el mensaje lo dice: *"La base de datos no tiene el esquema aplicado.
Ejecuta las migraciones: npm run migrate"*.

**IDs.** Siempre enteros positivos en la URL. Un id no numérico (`abc`, `1.5`, `-1`)
devuelve `400`, no `500`.

**Fechas.** Entrada ISO: `2026-10-05T10:00:00`. Salida ISO con `Z`. La conversión a
UTC la hace el servidor, así que la hora que sale depende de la zona horaria de
donde esté desplegado: una cita de las 10:00 sale como `10:00:00.000Z` en un
servidor en UTC y como `14:00:00.000Z` en uno en UTC-4 (Venezuela). No es un error
de la API, pero conviene saberlo al comparar con la base de datos.

**Roles.** `cliente` (por defecto), `barbero`, `administrador`.

| Rol | Puede |
|---|---|
| `cliente` | Registrarse, agendar citas, verlas y cancelar las suyas |
| `barbero` | Lo de cliente + cambiar el estado de las citas de su agenda, gestionar **su** horario y **sus** servicios |
| `administrador` | Todo lo anterior + el libro de saldo (`/api/transacciones`), el catálogo, las fichas de los barberos y el listado de usuarios |

**Permisos que dependen de *de quién* son los datos.** En varias rutas el rol
admite a `administrador` y a `barbero`, y es el controlador el que decide si el
barbero que llama es el dueño de lo que quiere cambiar. Un barbero que intenta
tocar el horario, los servicios o la ficha de **otro** barbero recibe un `403`.

---

## Autenticación

### `POST /api/auth/login` · pública

```jsonc
// petición
{ "correo": "admin@barberia.com", "password": "secreto123" }

// respuesta 200
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "8h",
  "usuario": {
    "usuarioID": 1, "nombre": "Admin", "apellido": "Principal",
    "correo": "admin@barberia.com", "rol": "administrador"
  }
}
```

| Código | Cuándo |
|---|---|
| `200` | Credenciales correctas |
| `400` | Falta `correo` o `password` |
| `401` | Credenciales incorrectas (mensaje genérico, no revela si el correo existe) |
| `429` | Más de 10 intentos fallidos en 15 minutos |

El token va en `Authorization: Bearer <token>`. **No hay refresh ni logout**: dura 8 h
y hay que descartarlo a mano.

### `POST /api/auth/recuperar` · pública

Recupera la contraseña **sin correo saliente**: la identidad se confirma con el par
correo + teléfono de la cuenta (los dos datos que el usuario ya conoce y que están
en su ficha). Es lo que usa la página "Recuperar contraseña" (`pages/Recuperar.jsx`).

```jsonc
// petición
{ "correo": "cliente@barberia.com", "telefono": "3000000000", "claveNueva": "nueva123" }

// respuesta 200
{ "ok": true, "message": "Contraseña actualizada exitosamente" }
```

| Código | Cuándo |
|---|---|
| `200` | Correo y teléfono coinciden; la clave quedó actualizada |
| `400` | Faltan datos, o la clave nueva tiene menos de 6 caracteres |
| `404` | El correo no existe **o** el teléfono no es el de la cuenta (el mismo mensaje en los dos casos, para no revelar qué correos están registrados) |
| `429` | Más de 10 intentos fallidos en 15 minutos |

El teléfono se compara **solo con sus dígitos**, así que da igual si la ficha lo
guarda como `0412-435.08.53` o como `04124350853`. La clave nueva siempre se
guarda como hash bcrypt (las cuentas antiguas que aún la tenían en texto plano
quedan migradas al recuperarla).

**Aviso de seguridad.** Esta ruta es un formulario libre para probar correos y
teléfonos: quien conozca los dos datos de una cuenta puede entrar en ella. Sin un
servicio de correo saliente no hay forma de hacer la verificación mejor sin tocar
el diseño de la web. Por eso tiene su propio limitador de intentos (10 por IP cada
15 minutos, aparte del del login) y por eso el frontend confirma con los dos
datos y no solo con el correo.

### `GET /api/auth/me` · requiere token

Devuelve el usuario del token. Útil al recargar la página.

```jsonc
// respuesta 200
{ "ok": true, "usuario": { "usuarioID": 1, "nombre": "Admin", "apellido": "Principal",
  "correo": "admin@barberia.com", "telefono": "3000000000", "rol": "administrador" } }
```

| Código | Cuándo |
|---|---|
| `200` | Sesión válida |
| `401` | Sin token, token inválido o expirado, o la cuenta ya no existe |

---

## Usuarios

> Campo de contraseña: **`clave` o `password`** (ambos funcionan). Obligatorios:
> `nombre`, `apellido`, `correo`, `telefono` y la contraseña. `rol` es opcional y
> por defecto vale `cliente`.

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/usuarios` | **`administrador`** | `{ ok, total, usuarios: [...] }` |
| `GET` | `/api/usuarios/:id` | **`administrador`** | `{ ok, usuario: {...} }` |
| `POST` | `/api/usuarios` | pública | `{ ok, message, usuario, citasVinculadas }` · `201` |
| `PUT` | `/api/usuarios/perfil` | token | `{ ok, message, usuario }` |
| `PUT` | `/api/usuarios/:id` | **`administrador`** | `{ ok, message, usuario }` |
| `DELETE` | `/api/usuarios/:id` | **`administrador`** | `{ ok, message, usuarioID }` |

```jsonc
// POST /api/usuarios
{ "nombre": "Ada", "apellido": "Lovelace", "correo": "ada@barberia.com",
  "telefono": "3000000000", "clave": "secreta123" }

// un usuario devuelto (nunca incluye `clave`)
{ "usuarioID": 1, "nombre": "Ada", "apellido": "Lovelace",
  "correo": "ada@barberia.com", "telefono": "3000000000", "rol": "cliente" }
```

`PUT` es parcial: los campos ausentes se conservan.

### Las citas de invitado se heredan al registrarse

Quien reservó **sin cuenta** y luego se registra con el mismo teléfono se lleva
esas citas a su cuenta nueva: pasan a tener `clienteID` y dejan de ser de
invitado. La respuesta del alta dice cuántas fueron:

```jsonc
{ "ok": true, "message": "Usuario creado exitosamente",
  "usuario": { "usuarioID": 42, … },
  "citasVinculadas": 1 }
```

El teléfono se compara **solo con sus dígitos**, así que da igual si la reserva
lo guardó como `0412 1234567` y la cuenta nueva lo teclea como `04121234567`. La
web usa ese número para llevar al recién registrado a "Mis citas" en vez de a la
página de reservas.

El alta y la vinculación van en la misma transacción: o la cuenta existe y sus
citas quedan colgando de ella, o no existe ninguna de las dos.

### El registro es público, pero el rol no se elige

`POST /api/usuarios` es el alta desde el formulario de registro de la web, así que
es pública. Lo que **no** puede hacer quien se registra es elegir su rol: si el
cuerpo trae `rol: "administrador"`, la API responde `403` salvo que quien llama
sea un administrador.

| Quién llama | `rol` en el cuerpo | Resultado |
|---|---|---|
| Sin token | (ninguno) | Se crea de tipo `cliente` |
| Sin token | `administrador` / `barbero` | `403` |
| `cliente` | (ninguno) | Se crea de tipo `cliente` |
| `cliente` | `administrador` / `barbero` | `403` |
| `administrador` | cualquiera de los tres | Se crea con ese rol |

Si el `rol` no es uno de `cliente`, `barbero` o `administrador`, la respuesta es
`400` (es el CHECK de la columna).

### Listar y editar usuarios de otros es solo del administrador

`GET /api/usuarios`, `GET /api/usuarios/:id`, `PUT /api/usuarios/:id` y
`DELETE /api/usuarios/:id` son rutas de administración: sin token dan `401` y con
un token que no sea de administrador dan `403`.

**Quien sí puede editar su propia cuenta** es `PUT /api/usuarios/perfil`, que
toma el `usuarioID` del token (no de la URL) y por tanto no sirve para tocar la
cuenta de otra persona. Si el cuerpo trae `claveActual` y `claveNueva`, la ruta
cambia la contraseña (mínimo 6 caracteres) y no toca nada más.

| Error | Cuándo |
|---|---|
| `400` | Faltan obligatorios, o el `id` no es numérico |
| `403` | Rol insuficiente, o se pidió un `rol` que no se puede dar |
| `404` | El usuario no existe (en `:id`) |
| `400` | Correo ya registrado |

**Aviso:** el `UNIQUE` de correo distingue mayúsculas. `Ada@x.com` y `ada@x.com` son
cuentas distintas.

---

## Servicios

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/servicios` | pública | `{ ok, total, servicios: [...] }` |
| `GET` | `/api/servicios/:id` | pública | `{ ok, servicio: {...} }` |
| `POST` | `/api/servicios` | **`administrador`** | `{ ok, message, servicio }` · `201` |
| `PUT` | `/api/servicios/:id` | **`administrador`** | `{ ok, message, servicio }` |
| `DELETE` | `/api/servicios/:id` | **`administrador`** | `{ ok, message, servicio }` |

```jsonc
// POST /api/servicios
{ "nombre": "Corte Clásico", "descripcion": "Corte tradicional",
  "precio": 15, "duracion_minutos": 30 }

// respuesta
{ "serviciosID": 1, "nombre": "Corte Clásico", "descripcion": "Corte tradicional",
  "precio": "15.00", "duracion_minutos": 30 }
```

`precio` y `duracion_minutos` son obligatorios. `precio` no puede ser negativo y
tiene un máximo de `99999999.99` (el límite de la columna `numeric(10,2)`);
`duracion_minutos` debe ser un entero mayor que cero. `precio` sale como string
(numérico de PostgreSQL), no como número.

`PUT` es parcial: solo se tocan los campos que llegan. `DELETE` borra el servicio
y sus asignaciones a barberos, pero **no** se puede borrar un servicio que ya
tiene citas registradas (responde `400`): esas citas se irían con él.

---

## Barberos

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/barberos` | pública | `{ ok, total, barberos: [...] }` |
| `GET` | `/api/barberos/:id` | pública | `{ ok, barbero: {...} }` |
| `POST` | `/api/barberos` | **`administrador`** | `{ ok, message, barbero }` · `201` |
| `PUT` | `/api/barberos/:id` | `administrador` / `barbero` | `{ ok, message, barbero }` |
| `POST` | `/api/barberos/:id/foto` | `administrador` / `barbero` | `{ ok, message, barbero }` · `201` |

Dar de alta a un barbero es una operación del negocio: la hace el administrador.
Un `barbero` o un `cliente` que lo intentan reciben un `403`.

```jsonc
// POST /api/barberos — convierte un usuario existente en barbero
{ "usuarioID": 1, "comision": 20.0, "estado": true }

// respuesta (incluye los datos del usuario unidos)
{ "barberoID": 1, "usuarioID": 1, "nombre": "Ada", "apellido": "Lovelace",
  "correo": "ada@barberia.com", "telefono": "3000000000",
  "comision": "20.00", "estado": true }
```

`estado` es opcional y por defecto `true` (barbero activo). **Un usuario solo puede
ser barbero una vez.**

### Editar un barbero

`PUT /api/barberos/:id` es parcial: solo se tocan los campos que llegan.

| Campo | Quién puede cambiarlo | Para qué |
|---|---|---|
| `comision` | solo `administrador` | Porcentaje que se lleva el barbero |
| `estado` | solo `administrador` | Activar o desactivar el barbero |
| `descripcion`, `especialidad`, `instagram`, `telefono_contacto` | `administrador` o el propio barbero | Ficha pública |

Un barbero que intenta cambiar `comision` o `estado` recibe un `403`, y si intenta
editar la ficha de otro barbero, también.

### Foto de un barbero

`POST /api/barberos/:id/foto` con `multipart/form-data` y el campo `foto`
(JPG, PNG, WEBP o GIF; máximo 5 MB). La API guarda el archivo en
`backend/uploads` y devuelve la ficha con `foto_url` (por ejemplo
`/uploads/9f8c….jpg`). Los archivos se sirven en `/uploads`.

---

## Servicios por barbero

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/barbero-servicios/barbero/:barberoID` | pública | `{ ok, total, servicios: [...] }` |
| `POST` | `/api/barbero-servicios` | `administrador` / `barbero` | `{ ok, message, asignacion }` · `201` |
| `DELETE` | `/api/barbero-servicios/:barberoID/:servicioID` | `administrador` / `barbero` | `{ ok, message, barbero_servicioID }` |

```jsonc
// POST /api/barbero-servicios
{ "barberoID": 1, "servicioID": 1 }
```

Asignar dos veces el mismo servicio devuelve `400`. No se puede asignar un servicio a
un barbero inexistente.

**Solo la propia ficha.** El administrador puede asignar servicios a quien quiera.
Un `barbero` solo puede tocar los servicios de **su** ficha: si envía un
`barberoID` que no es el suyo, la respuesta es `403` con el mensaje *"Solo puedes
modificar los servicios de tu propia ficha"*. Lo mismo con `DELETE`.

---

## Reseñas

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/barberos/:barberoID/resenas` | pública | `{ ok, total, promedio, resenas: [...] }` |
| `POST` | `/api/barberos/:barberoID/resenas` | token | `{ ok, message, resena }` · `201` |
| `GET` | `/api/barberos/resenas` | **`administrador`** | `{ ok, total, resenas: [...] }` |
| `DELETE` | `/api/barberos/resenas/:resenaID` | **`administrador`** | `{ ok, message, resenaID }` |

```jsonc
// POST /api/barberos/1/resenas
{ "calificacion": 5, "comentario": "Muy buen servicio" }

// respuesta
{ "resenaID": 1, "barberoID": 1, "autorID": 2, "calificacion": 5,
  "comentario": "Muy buen servicio", "fecha_creacion": "2026-10-03T15:42:32.918Z" }
```

| Campo | Notas |
|---|---|
| `calificacion` | Obligatoria, entero del 1 al 5 |
| `comentario` | Texto opcional |
| `autorID` | Solo el administrador lo puede mandar (para registrar una reseña que un cliente dejó por otra vía) |

**Solo se puede opinar de un barbero al que se le ha hecho una cita completada.**
Sin esa condición, cualquiera podría opinar de un barbero que no ha conocido. Si
el cliente vuelve a opinar del mismo barbero, la reseña **se actualiza** en vez de
crear otra (`ON CONFLICT` sobre `barberoID` + `autorID`).

El administrador se salta esa comprobación y puede crear reseñas en nombre de un
cliente.

---

## Horarios laborales

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/horarios/barbero/:barberoID` | pública | `{ ok, total, horarios: [...] }` |
| `POST` | `/api/horarios` | `administrador` / `barbero` | `{ ok, message, horario }` · `201` |
| `DELETE` | `/api/horarios/barbero/:barberoID/:dia` | `administrador` / `barbero` | `{ ok, message, horarioID }` |

```jsonc
// POST /api/horarios — upsert: si el barbero ya tiene ese día, lo reemplaza
{ "barberoID": 1, "dia_semana": "lunes", "hora_inicio": "09:00", "hora_fin": "17:00" }

// respuesta
{ "horarioID": 1, "barberoID": 1, "dia_semana": "lunes",
  "hora_inicio": "09:00:00", "hora_fin": "17:00:00" }
```

| Campo | Notas |
|---|---|
| `dia_semana` | Uno de `lunes`, `martes`, `miercoles`, `jueves`, `viernes`, `sabado`, `domingo`. Sin tilde y en minúsculas: se envía como sea y el servidor lo normaliza |
| `hora_inicio` / `hora_fin` | `HH:MM`. `hora_fin` debe ser **posterior** a `hora_inicio` |

Un horario por barbero y día: repetir el `POST` actualiza, no duplica.

**Solo el propio horario.** El administrador puede configurar el de quien quiera.
Un `barbero` solo puede tocar el horario de **su** agenda: si envía un `barberoID`
que no es el suyo, la respuesta es `403` con el mensaje *"Solo puedes modificar tu
propio horario"*. Lo mismo con `DELETE`.

---

## Citas

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/citas` | token | `{ ok, total, citas: [...] }` |
| `POST` | `/api/citas` | token | `{ ok, message, cita }` · `201` |
| `PUT` | `/api/citas/:id` | token | `{ ok, message, cita }` (reprogramar) |
| `PUT` | `/api/citas/:id/estado` | token | `{ ok, message, cita }` |
| `GET` | `/api/citas/ocupados` | pública | `{ ok, total, ocupados: [...] }` |
| `POST` | `/api/citas/publica` | pública | `{ ok, message, cita, codigo }` · `201` |
| `GET` | `/api/citas/publica/:codigo` | pública | `{ ok, cita }` |
| `PUT` | `/api/citas/publica/:codigo/estado` | pública | `{ ok, message, cita }` |

```jsonc
// POST /api/citas
{ "clienteID": 2, "barberoID": 1, "servicioID": 1, "fecha_hora": "2026-10-05T10:00:00" }

// GET /api/citas — una cita trae los nombres ya unidos
{ "citaID": 1, "clienteID": 2, "barberoID": 1, "servicioID": 1,
  "fecha_inicio": "2026-10-05T14:00:00.000Z", "fecha_fin": "2026-10-05T14:30:00.000Z",
  "estado": "pendiente",
  "cliente_nombre": "Ada", "cliente_apellido": "Lovelace",
  "barbero_nombre": "Grace", "barbero_apellido": "Hopper",
  "servicio_nombre": "Corte Clásico", "precio": "15.00", "duracion_minutos": 30 }
```

**La hora de fin la calcula el servidor** a partir de `duracion_minutos` del servicio.
No se envía.

### Cada rol ve solo lo suyo

`GET /api/citas` recorta la agenda según el rol de quien pregunta:

| Rol | Qué recibe |
|---|---|
| `administrador` | Todas las citas de la peluquería |
| `barbero` | Solo las citas de su propia agenda |
| `cliente` | Solo sus propias citas |

Sin ese filtro, un cliente autenticado recibía la agenda completa con el nombre y
el teléfono de todos los demás clientes. La web ("Mis citas") da por hecho que el
recorte lo hace el backend.

### Agendar

**Al agendar se valida, en este orden:**

1. El barbero existe y está activo.
2. El servicio existe.
3. **La peluquería abre ese día**: no es domingo (día de descanso) ni un
   feriado. Ver [`GET /api/feriados`](#get-apiferiados--pública).
4. El barbero tiene horario configurado para **ese día de la semana**.
5. La cita completa dentro de ese horario (empieza después de `hora_inicio` y
   termina antes de `hora_fin`).
6. No se solapa con otra cita del mismo barbero. Las canceladas no bloquean.

La comprobación y el `INSERT` van en la misma transacción, con la fila del barbero
bloqueada: dos reservas simultáneas para la misma hora no pueden colarse.

Un `cliente` solo agenda **en su nombre**: mandar un `clienteID` que no es el suyo
es un `403`. El `administrador` sí puede agendar para quien quiera.

| Error | Cuándo |
|---|---|
| `400` | Es domingo (día de descanso) o es un feriado |
| `400` | El barbero no tiene horario para ese día, o la cita cae fuera del horario |
| `400` | Se solapa con otra cita |
| `400` | El barbero no está activo |
| `400` | La cita cruzaría la medianoche |
| `400` | A un invitado le falta el nombre o el teléfono (mínimo 7 dígitos) |
| `403` | Se intenta agendar en nombre de otro |
| `404` | El barbero o el servicio no existen |

### Reserva sin cuenta (público)

Quien reserva sin registrarse lo hace por `POST /api/citas/publica`, que es
público. La cita se guarda como **invitada** (sin `clienteID`, con
`contacto_nombre` y `contacto_telefono`) y la respuesta trae un `codigo`: 12 bytes
aleatorios en hexadecimal, 24 caracteres.

Ese código es la **única** forma de volver a la cita sin cuenta, y da acceso a:

```jsonc
// GET /api/citas/publica/:codigo
{ "ok": true, "cita": { "citaID": 7, "estado": "pendiente", "codigo": "0b9b…", … } }

// PUT /api/citas/publica/:codigo/estado  → cancela la cita
{ "ok": true, "message": "Cita cancelada exitosamente", "cita": { … } }
```

Solo se puede cancelar una cita que siga `pendiente` o `confirmada`: una cita
completada o ya cancelada devuelve `400`. Un código que no existe devuelve `404`.

### Forma de pago al reservar

Al reservar, el cliente elige **cómo va a pagar**. Las dos rutas de reserva
(`POST /api/citas` y `POST /api/citas/publica`) aceptan las dos formas:

- **Pago móvil**: el cliente sube el comprobante del pago (una imagen) y escribe
  su referencia. La cita se agenda **esperando el visto bueno** del
  administrador: el comprobante llega a la pestaña de Pagos del panel y, si el
  administrador lo aprueba, la cita sigue su curso normal (queda confirmada); si
  lo rechaza, la cita queda **denegada** y el cliente ve el motivo.
- **Efectivo o tarjeta**: la cita se agenda normal y se queda con la etiqueta de
  **pago pendiente** hasta que se cobre en el local.

```jsonc
// POST /api/citas/publica  (JSON, pago en el local)
{ "barberoID": 1, "servicioID": 1, "fecha_hora": "2026-10-05T10:00:00",
  "nombre": "Ada", "apellido": "Lovelace", "telefono": "04141234567",
  "pago_metodo": "efectivo" }

// POST /api/citas/publica  (multipart, pago móvil)
//   barberoID, servicioID, fecha_hora, nombre, apellido, telefono,
//   pago_metodo=pago_movil, referencia_pago y comprobante (archivo)
```

| Campo | Notas |
|---|---|
| `pago_metodo` | `efectivo`, `tarjeta` o `pago_movil`. Si no viene, la cita se agenda sin método de pago |
| `referencia_pago` | Obligatoria si el método es `pago_movil` |
| `comprobante` | Archivo (multipart, campo `comprobante`). Obligatorio si el método es `pago_movil` |

Cuando el pago es por móvil, la cita y su comprobante se guardan **en la misma
transacción de base de datos**: o quedan los dos, o no queda ninguno.

**La cita guarda su pago.** Tres columnas nuevas (migración 010) dejan la etiqueta
guardada en la base de datos, para que no dependa de que haya o no una fila en
`transacciones`:

| Campo | Qué es |
|---|---|
| `pago_metodo` | `efectivo`, `tarjeta` o `pago_movil` (o `null` si no se eligió) |
| `pago_estado` | `pendiente`, `completado` o `rechazado` (o `null`) |
| `motivo_pago` | El motivo con el que el administrador denegó el pago |

```jsonc
// GET /api/citas — una cita con su pago
{ "citaID": 9, "estado": "pendiente",
  "pago_metodo": "pago_movil", "pago_estado": "pendiente", "motivo_pago": null }
```

| Error | Cuándo |
|---|---|
| `400` | El pago móvil viene sin comprobante |
| `400` | El pago móvil viene sin referencia |
| `400` | El método de pago no es uno de los tres |

### Horas ocupadas (público)

`GET /api/citas/ocupados?barberoID=1` devuelve los intervalos ya reservados de
un barbero. La web los consulta **antes** de que el cliente haya iniciado sesión,
para no ofrecer unas horas que el servidor va a rechazar.

Devuelve solo el intervalo y el estado (nada del cliente):

```jsonc
{ "ok": true, "total": 1,
  "ocupados": [{ "citaID": 3, "fecha_inicio": "2026-10-05T14:00:00.000Z",
                 "fecha_fin": "2026-10-05T14:30:00.000Z", "estado": "pendiente" }] }
```

Parámetros opcionales: `desde` y `hasta` (fechas `YYYY-MM-DD`) acotan el rango, y
`excluir` (id de cita) deja de bloquear una cita que se está reprogramando, para
que no se bloquee a sí misma.

### Reprogramar

`PUT /api/citas/:id` mueve una cita a otra fecha y hora. Pasa por **las mismas**
comprobaciones que una reserva nueva (descanso, feriado, horario laboral y
solapamiento), excluyendo la propia cita del cruce.

```jsonc
// PUT /api/citas/:id
{ "fecha_hora": "2026-10-12T10:00:00" }
```

Quién puede reprogramar: el `administrador` (cualquiera), el `cliente` dueño de la
cita y el `barbero` cuya agenda la contiene. En cualquier otro caso, `403`. Una
cita `cancelada` o `completada` no se reprograma (`400`).

### Estados de una cita

`pendiente` → `confirmada` → `completada`, o → `cancelada` en cualquier momento.
**El servidor no impone el orden**: acepta cualquiera de los cinco. La validación
vive en el frontend.

```jsonc
// PUT /api/citas/:id/estado
{ "estado": "confirmada" }
```

| Estado | Qué significa |
|---|---|
| `pendiente` | Agendada, sin confirmar |
| `confirmada` | Confirmada (también cuando el administrador aprueba el pago móvil) |
| `completada` | Ya se hizo el servicio |
| `cancelada` | La canceló el cliente, el barbero o el administrador |
| `denegada` | **El administrador denegó el comprobante de pago** (estado nuevo, migración 010) |

`denegada` es distinta de `cancelada` a propósito: la cita no se canceló, se le
**rechazó el pago**. Por eso guarda además el `motivo_pago`, que es el mensaje que
ve el cliente. Una cita `denegada` no bloquea la agenda del barbero (no cuenta
como ocupado) y no se puede reprogramar.

Quién puede cambiar el estado:

| Rol | Qué puede |
|---|---|
| `administrador` | Cualquier estado, en cualquier cita |
| `barbero` | Cualquier estado, pero solo en las citas de **su** agenda |
| `cliente` | Solo **cancelar** una cita **suya** |

El `cliente` puede cancelar porque la web le muestra el botón "Cancelar" en "Mis
citas": sin esa excepción el botón siempre fallaría con un `403`. Cualquier otro
cambio de estado hecho por un cliente es un `403`.

Un `401` significa token ausente o expirado. Un `403` significa rol insuficiente o
que el recurso no es de quien pregunta.

---

## Días no laborables

La peluquería no abre los **domingos** (día de descanso) ni en los **feriados**.

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/feriados` | pública | `{ ok, dias_descanso, feriados: [...] }` |
| `POST` | `/api/feriados` | **`administrador`** | `{ ok, message, feriado }` · `201` |
| `DELETE` | `/api/feriados/:fecha` | **`administrador`** | `{ ok, message }` |

### `GET /api/feriados` · pública

Devuelve los días en los que no se puede reservar. La web la consulta antes de
que el cliente haya iniciado sesión, para no ofrecer unas fechas que el
servidor va a rechazar.

```jsonc
// respuesta 200
{
  "ok": true,
  "dias_descanso": ["domingo"],
  "feriados": [
    { "fecha": "2026-01-01", "nombre": "Año Nuevo", "tipo": "festivo" },
    { "fecha": "2026-02-16", "nombre": "Carnaval (lunes)", "tipo": "carnaval" }
  ]
}
```

| Campo | Qué es |
|---|---|
| `dias_descanso` | Días de la semana sin servicio, en minúsculas y sin tilde |
| `feriados` | Fechas concretas, ordenadas de menor a mayor |
| `feriado.tipo` | `festivo`, `religioso` o `carnaval` |

**De dónde salen los feriados.** Están en la tabla `feriado` (migración 007),
que viene con los feriados de Venezuela de 2026 y 2027. Para otros años se
añaden las filas a mano:

```sql
INSERT INTO feriado (fecha, nombre, tipo) VALUES ('2028-01-01', 'Año Nuevo', 'festivo');
```

El tipo no obliga a nada: es informativo, para poder distinguirlos si en
algún momento hace falta (por ejemplo, si un feriado se compensa con un día
extra de la semana).

**La comprobación es del servidor, no solo de la web.** `POST /api/citas`
rechaza con `400` cualquier cita que caiga en domingo o en feriado, aunque se
llame a la API directamente. El frontend solo lo anticipa para no ofrecer
esas fechas.

---

## Transacciones (pagos de cita y saldo)

La tabla `transacciones` guarda dos cosas distintas: el **pago de una cita** y los
**movimientos de saldo** del modelo de prepago.

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/transacciones` | **`administrador`** | `{ ok, total, transacciones: [...] }` |
| `POST` | `/api/transacciones` | `administrador` / `cliente` / `barbero` | `{ ok, message, transaccion }` · `201` |
| `GET` | `/api/transacciones/:id` | **`administrador`** | `{ ok, transaccion }` |
| `PUT` | `/api/transacciones/:id/aprobar` | **`administrador`** | `{ ok, message, transaccion }` |
| `PUT` | `/api/transacciones/:id/rechazar` | **`administrador`** | `{ ok, message, transaccion }` |

`POST` decide qué es por el cuerpo: **si trae `citaID` es un pago de cita**; si no,
es un movimiento de saldo.

### Pago de una cita

```jsonc
// POST /api/transacciones  (JSON, sin comprobante)
{ "citaID": 7, "metodo_pago": "efectivo", "monto": 15000, "referencia_pago": "PAG-001" }

// respuesta
{ "transaccionID": 3, "citaID": 7, "metodo_pago": "efectivo", "estado": "completado",
  "monto": 15000, "referencia_pago": "PAG-001", "fecha_creacion": "2026-10-03T15:42:32.918Z" }
```

| Campo | Notas |
|---|---|
| `metodo_pago` | `efectivo`, `tarjeta` o `pago_movil`. Por defecto `efectivo` |
| `referencia_pago` | Obligatoria si el método es `pago_movil` (sin ella el comprobante no se puede revisar) |
| `monto` | Si no viene, se toma el precio del servicio de la cita |
| `comprobante` | Archivo (multipart, campo `comprobante`) o `comprobante_url` ya subido |

El estado se decide solo: `efectivo` y `tarjeta` quedan `completado` (lo que se
cobra en el mostrador ya está pagado) y `pago_movil` queda `pendiente` hasta que
el administrador lo apruebe (`PUT /:id/aprobar`) o lo rechace
(`PUT /:id/rechazar`, que exige `motivo`).

Un `cliente` solo puede registrar el pago de **sus propias citas**: si la cita es
de otro, la respuesta es `403`.

### Revisar el comprobante (el botón verde y el rojo)

Los dos botones de la pestaña **Pagos** del panel del administrador son estas dos
rutas. Cuando la transacción es un pago de cita, el efecto cae también sobre la
cita:

| Botón | Ruta | Qué pasa con la transacción | Qué pasa con la cita |
|---|---|---|---|
| Verde · **Aprobar** | `PUT /api/transacciones/:id/aprobar` | `estado` → `completado`, se borra el motivo de rechazo | `pago_estado` → `completado`, `motivo_pago` → `null` y, si estaba `pendiente`, la cita pasa a `confirmada` |
| Rojo · **Rechazar** | `PUT /api/transacciones/:id/rechazar` | `estado` → `rechazado`, guarda `motivo` | `pago_estado` → `rechazado`, `motivo_pago` → el motivo y la cita pasa a `denegada` |

```jsonc
// PUT /api/transacciones/3/rechazar
{ "motivo": "El comprobante no se ve" }
```

Una cita ya `completada` o `cancelada` no cambia de estado: el pago se registra
igual, pero la cita se queda como estaba. La lógica está compartida en
`backend/src/utils/pagos.js` (`aprobarPagoCita` y `rechazarPagoCita`).

**El motivo es el mensaje del cliente.** No se manda ningún correo: el motivo se
guarda en la cita y el cliente lo ve en "Mis citas" y en la página pública de su
cita (la que abre con su código).

### Movimiento de saldo

```jsonc
// POST /api/transacciones  (sin citaID)
{ "usuarioID": 1, "tipo_movimiento": "recarga", "monto": 100,
  "saldo_restante": 100, "referencia_pago": "PAG-001" }
```

`referencia_pago` es **obligatoria** aunque la columna no lo sugiera. `tipo_movimiento`
es texto libre: la base no valida los valores.

---

## Estadísticas (panel del administrador)

### `GET /api/estadisticas/resumen` · **`administrador`**

Todas las cifras se calculan en el momento sobre la base de datos: no hay nada
cacheado, así que el panel refleja el estado real.

```jsonc
{ "ok": true, "generadoEn": "2026-10-03T15:42:32.918Z",
  "resumen": {
    "citasHoy": 3, "citasProximas": 12, "citasTotales": 148, "citasCanceladas": 9,
    "ingresosMes": 125000, "ingresosCompletadas": 940000, "ticketPromedio": 18000,
    "clientesTotales": 47, "barberosActivos": 4, "serviciosTotales": 8
  },
  "citasPorEstado": [{ "estado": "completada", "total": 96 }],
  "citasUltimos14Dias": [{ "fecha": "2026-09-20", "total": 4 }],
  "topServicios": [{ "nombre": "Corte Clásico", "total": 30, "ingresos": 450000 }],
  "rankingBarberos": [{ "barberoID": 1, "nombre": "Grace", "citas": 40,
                         "ingresos": 600000, "comisionEstimada": 120000 }],
  "ingresosPorMes": [{ "mes": "2026-09", "ingresos": 180000, "citas": 12 }] }
```

Los ingresos salen de los **pagos completados** (`transacciones`), no del precio del
servicio: así cuadran con lo que se ve en la pestaña de pagos. `ingresosPorMes`
mira los últimos 6 meses.

---

## Errores

| Código | Significado |
|---|---|
| `400` | Solicitud inválida o conflicto de negocio (datos faltantes, correo duplicado, barbero repetido, cita solapada o fuera de horario) |
| `401` | Sin autenticación: token ausente, inválido o expirado |
| `403` | Autenticado pero sin permiso (rol insuficiente, o el recurso no es de quien pregunta) |
| `404` | Ruta o recurso inexistente |
| `429` | Demasiados intentos en `/api/auth/login` o `/api/auth/recuperar` |
| `500` | Error interno del servidor |

Las rutas inexistentes devuelven 404 en JSON:

```json
{ "ok": false, "message": "Recurso no encontrado" }
```

---

## Lo que falta para un panel de administración

Si el frontend necesita gestionar el catálogo, la API tiene estos huecos:

| Módulo | Falta |
|---|---|
| Citas | `GET /api/citas/:id`, `DELETE /api/citas/:id` |
| Horarios | `PUT` (se resuelve con otro `POST`, es un upsert) |
| Auth | `POST /api/auth/logout` (hoy no hay revocación) |

Usuarios, servicios, barberos, citas, transacciones, feriados y reseñas ya tienen
su CRUD completo.

---

## La brecha entre la web y la API está cerrada

La web se construyó contra un contrato más grande del que la API implementaba.
Todas las rutas que la web llama **existen hoy**:

| Endpoint que llama el frontend | Dónde se usa |
|---|---|
| `GET /api/citas/ocupados` | `pages/Reservar.jsx` |
| `PUT /api/citas/:id` (reprogramar) | `pages/Reservar.jsx` |
| `POST /api/citas/publica` | `pages/Reservar.jsx` |
| `GET /api/citas/publica/:codigo` | `pages/CitaPublica.jsx` |
| `PUT /api/citas/publica/:codigo/estado` | `pages/CitaPublica.jsx` |
| `POST /api/auth/recuperar` | `pages/Recuperar.jsx` |
| `PUT /api/usuarios/perfil` | `pages/Perfil.jsx` |
| `PUT /api/barberos/:id` | `pages/PanelBarbero.jsx` |
| `POST /api/barberos/:id/foto` | `pages/PanelBarbero.jsx` |
| `GET/POST /api/barberos/:id/resenas` | `components/ModalBarbero.jsx` |
| `GET /api/barberos/resenas`, `DELETE /api/barberos/resenas/:id` | `pages/admin/AdminResenas.jsx` |
| `PUT/DELETE /api/servicios/:id` | `pages/admin/AdminServicios.jsx` |
| `GET /api/transacciones/:id`, `/:id/aprobar`, `/:id/rechazar` | `pages/admin/AdminTransacciones.jsx` |
| `GET /api/estadisticas/resumen` | `pages/admin/AdminResumen.jsx` |

`POST /api/transacciones` acepta **las dos formas**: con `citaID` es un pago de
cita, sin él es un movimiento de saldo. Antes eran dos modelos incompatibles y el
frontend usaba el que la API no entendía.