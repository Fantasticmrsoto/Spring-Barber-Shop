# Referencia de la API

Contrato de `http://localhost:3000` para construir el frontend.

La colección de Postman (`postman/My Collection.postman_collection.json`) ejercita todo
lo de esta tabla: 28 peticiones y 49 aserciones. Es la fuente de verdad ejecutable.

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

**IDs.** Siempre enteros positivos en la URL. Un id no numérico (`abc`, `1.5`, `-1`)
devuelve `400`, no `500`.

**Fechas.** Entrada ISO: `2026-10-05T10:00:00`. Salida ISO con `Z`.

**Roles.** `cliente` (por defecto), `barbero`, `administrador`.

| Rol | Puede |
|---|---|
| `cliente` | Agendar y listar citas |
| `barbero` | Lo de cliente + cambiar estado de cita, gestionar su horario y sus servicios, ver el saldo |
| `administrador` | Todo lo anterior |

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

### `POST /api/auth/recuperar` · pública

Recuperación de contraseña **sin correo saliente**: se confirma la identidad con el
`correo` y el `telefono` de la propia cuenta (ambos deben coincidir con la misma fila)
y se fija la nueva contraseña. Comparte el limitador del login para no servir de
oráculo de fuerza bruta.

```jsonc
// POST /api/auth/recuperar
{ "correo": "cliente@barberia.com", "telefono": "3000000000", "claveNueva": "nueva123" }
// respuesta 200
{ "ok": true, "message": "Contraseña actualizada. Ya puedes iniciar sesión." }
```

| Código | Cuándo |
|---|---|
| `400` | Faltan datos, la nueva contraseña tiene menos de 6 caracteres, o correo/teléfono no coinciden con ninguna cuenta |
| `429` | Más de 10 intentos fallidos en 15 minutos |


---

## Usuarios

> Campo de contraseña: **`clave` o `password`** (ambos funcionan). Obligatorios:
> `nombre`, `apellido`, `correo`, `telefono` y la contraseña. `rol` es opcional y
> por defecto vale `cliente`.

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/usuarios` | pública | `{ ok, total, usuarios: [...] }` |
| `GET` | `/api/usuarios/:id` | pública | `{ ok, usuario: {...} }` |
| `POST` | `/api/usuarios` | pública | `{ ok, message, usuario, citasVinculadas }` · `201` |
| `PUT` | `/api/usuarios/perfil` | token | `{ ok, message, usuario }` |
| `PUT` | `/api/usuarios/:id` | pública | `{ ok, message, usuario }` |
| `DELETE` | `/api/usuarios/:id` | pública | `{ ok, message, usuarioID }` |

```jsonc
// POST /api/usuarios
{ "nombre": "Ada", "apellido": "Lovelace", "correo": "ada@barberia.com",
  "telefono": "3000000000", "clave": "secreta123", "rol": "administrador" }

// un usuario devuelto (nunca incluye `clave`)
{ "usuarioID": 1, "nombre": "Ada", "apellido": "Lovelace",
  "correo": "ada@barberia.com", "telefono": "3000000000", "rol": "administrador" }
```

`PUT` es parcial: los campos ausentes se conservan.

### Autoservicio: `PUT /api/usuarios/perfil` · requiere token

Cualquier usuario autenticado edita **su propia** fila (el `usuarioID` sale del token,
nunca del cuerpo, así que no puede tocar a nadie más ni cambiarse el `rol`). Parcial:
`nombre`, `apellido`, `correo`, `telefono`. Para cambiar la contraseña se envían
`claveActual` y `claveNueva` (mínimo 6 caracteres); sin `claveActual` correcta responde
`403`.

```jsonc
// PUT /api/usuarios/perfil
{ "nombre": "Leo", "telefono": "3001112233" }
// o, para cambiar la contraseña:
{ "claveActual": "actual123", "claveNueva": "nueva123" }
```

| Error | Cuándo |
|---|---|
| `400` | Un campo enviado queda vacío, o la nueva contraseña es corta / no se envía `claveActual` |
| `400` | El correo ya lo usa otra cuenta |
| `401` | Sin token |
| `403` | `claveActual` incorrecta |


Al crear un `cliente`, el servidor **vincula las citas de invitado** hechas antes con
ese mismo teléfono y devuelve cuántas en `citasVinculadas` (ver *Reserva de invitado*).

| Error | Cuándo |
|---|---|
| `400` | Faltan obligatorios, o el `id` no es numérico |
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
| `POST` | `/api/servicios` | pública | `{ ok, message, servicio }` · `201` |
| `PUT` | `/api/servicios/:id` | **`administrador`** | `{ ok, message, servicio }` |
| `DELETE` | `/api/servicios/:id` | **`administrador`** | `{ ok, message, serviciosID }` |

```jsonc
// POST /api/servicios
{ "nombre": "Corte Clásico", "descripcion": "Corte tradicional",
  "precio": 15, "duracion_minutos": 30 }

// respuesta
{ "serviciosID": 1, "nombre": "Corte Clásico", "descripcion": "Corte tradicional",
  "precio": "15.00", "duracion_minutos": 30 }
```

`precio` y `duracion_minutos` son obligatorios y positivos. `precio` sale como string
(numérico de PostgreSQL), no como número.

`PUT /api/servicios/:id` es parcial: solo cambia los campos enviados (`nombre`,
`descripcion`, `precio`, `duracion_minutos`). Un `PUT` sin campos responde `400`.

```jsonc
// PUT /api/servicios/1
{ "precio": 18, "duracion_minutos": 45 }
```

`DELETE /api/servicios/:id` **se bloquea si el servicio tiene citas asociadas**
(`409`), porque las citas lo referencian con `ON DELETE CASCADE` y borrarlo se
llevaría el historial. Las asignaciones a barberos (`barbero_servicio`) sí se limpian
solas.

```jsonc
// DELETE /api/servicios/1 — respuesta 200 si no tiene citas
{ "ok": true, "message": "Servicio eliminado exitosamente", "serviciosID": 1 }
```

| Código | Cuándo (PUT/DELETE) |
|---|---|
| `400` | `id` no numérico, o `PUT` sin campos / con valores inválidos |
| `401` | Sin token |
| `403` | Rol distinto de `administrador` |
| `404` | El servicio no existe |
| `409` | `DELETE` de un servicio con citas asociadas |

> Nota: `POST /api/servicios` sigue siendo público (compatibilidad con los seeds).

---

## Barberos

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/barberos` | pública | `{ ok, total, barberos: [...] }` |
| `GET` | `/api/barberos/:id` | pública | `{ ok, barbero: {...} }` |
| `POST` | `/api/barberos` | pública | `{ ok, message, barbero }` · `201` |
| `PUT` | `/api/barberos/:id` | `administrador` / `barbero` | `{ ok, message, barbero }` |
| `POST` | `/api/barberos/:id/foto` | `administrador` / `barbero` | `{ ok, message, barbero }` · `201` |
| `GET` | `/api/barberos/:id/resenas` | pública | `{ ok, total, promedio, resenas: [...] }` |
| `POST` | `/api/barberos/:id/resenas` | autenticado | `{ ok, message, resena }` · `201` |
| `GET` | `/api/barberos/resenas` | `administrador` | `{ ok, total, resenas: [...] }` |
| `DELETE` | `/api/barberos/resenas/:resenaID` | `administrador` | `{ ok, message, resenaID }` |

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

### Perfil del barbero

El barbero tiene datos públicos que se muestran en su perfil y en la landing:
`descripcion`, `especialidad`, `instagram`, `telefono` (contacto público) y
`foto_url`.

`PUT /api/barberos/:id` es parcial y **un barbero solo puede editar su propio perfil**
(`403` si intenta otro). Solo el `administrador` puede tocar `comision` y `estado`.

```jsonc
// PUT /api/barberos/1  (barbero sobre sí mismo)
{ "descripcion": "Fades y barba", "especialidad": "Fade", "instagram": "@grace",
  "telefono": "3000000000" }
```

`POST /api/barberos/:id/foto` recibe `multipart/form-data` con el campo **`foto`**
(JPG, PNG, WEBP o GIF, máx. 5 MB). Guarda el archivo y devuelve el barbero con su
`foto_url` (ruta relativa, servida en `/uploads`).

`GET /api/barberos` y `GET /api/barberos/:id` incluyen además el promedio y el total
de reseñas de cada barbero: `promedio_calificacion` (ej. `"4.5"`, o `0` si no hay
reseñas) y `total_resenas`.

### Reseñas

Un cliente autenticado puede dejar **una** calificación (de `0.5` a `5`, en pasos de
media estrella) y un comentario sobre un barbero. **Solo se permite si el cliente ya
tuvo una cita `completada` con ese barbero**; en caso contrario responde `403`.
Reenviar la reseña **actualiza** la existente (upsert por `barberoID` + `usuarioID`),
no la duplica.

```jsonc
// POST /api/barberos/1/resenas
{ "calificacion": 4.5, "comentario": "Excelente corte, muy profesional." }

// GET /api/barberos/1/resenas
{ "ok": true, "total": 1, "promedio": 4.5,
  "resenas": [{ "resenaID": 1, "usuarioID": 7, "calificacion": "4.5",
                "comentario": "Excelente corte, muy profesional.",
                "fecha_creacion": "2026-10-13T05:47:32", "nombre": "Leo", "apellido": "Soto" }] }
```

| Código | Cuándo (`POST`) |
|---|---|
| `400` | `id` no numérico, `calificacion` fuera de 0.5-5 (o no múltiplo de 0.5) o ausente, o comentario > 500 caracteres |
| `401` | Sin token |
| `403` | El cliente no tiene una cita `completada` con ese barbero |
| `404` | El barbero no existe |

### Moderación de reseñas · `administrador`

`GET /api/barberos/resenas` lista **todas** las reseñas (con el barbero y el autor ya
unidos) y `DELETE /api/barberos/resenas/:resenaID` elimina una. Requieren token de
`administrador` (`401` sin token, `403` con otro rol).

```jsonc
// GET /api/barberos/resenas
{ "ok": true, "total": 1, "resenas": [{
  "resenaID": 1, "barberoID": 1, "usuarioID": 7, "calificacion": 5,
  "comentario": "Excelente corte.", "fecha_creacion": "2026-10-13T05:47:32",
  "barbero_nombre": "Carlos", "barbero_apellido": "Pérez",
  "autor_nombre": "Leo", "autor_apellido": "Soto" }] }
```

| Código | Cuándo (`DELETE`) |
|---|---|
| `400` | `resenaID` no numérico |
| `404` | La reseña no existe |


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

---

## Citas

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/citas` | token | `{ ok, total, citas: [...] }` |
| `POST` | `/api/citas` | token | `{ ok, message, cita }` · `201` |
| `PUT` | `/api/citas/:id/estado` | `administrador` / `barbero` / `cliente` | `{ ok, message, cita }` |
| `PUT` | `/api/citas/:id` | `administrador` / `cliente` | `{ ok, message, cita }` |
| `GET` | `/api/citas/ocupados` | pública | `{ ok, ocupados: [...] }` |
| `POST` | `/api/citas/publica` | pública | `{ ok, message, cita, codigo }` · `201` |
| `GET` | `/api/citas/publica/:codigo` | pública | `{ ok, cita }` |
| `PUT` | `/api/citas/publica/:codigo/estado` | pública | `{ ok, message, cita }` |

**`GET /api/citas` se acota según el rol del token:** el `administrador` ve todas, el
`barbero` solo las de su agenda y el `cliente` solo las propias. Sin token responde
`401`.

```jsonc
// POST /api/citas  (con sesión; el cliente solo puede agendar para sí mismo)
{ "clienteID": 2, "barberoID": 1, "servicioID": 1, "fecha_hora": "2026-10-05T10:00:00" }

// POST /api/citas  (staff: reserva manual "walk-in" sin cuenta)
{ "barberoID": 1, "servicioID": 1, "fecha_hora": "2026-10-05T10:00:00",
  "contacto_nombre": "Cliente Pasajero", "contacto_telefono": "3009998888" }

// GET /api/citas — una cita trae los nombres ya unidos
{ "citaID": 1, "clienteID": 2, "barberoID": 1, "servicioID": 1,
  "fecha_inicio": "2026-10-05T10:00:00", "fecha_fin": "2026-10-05T10:30:00",
  "estado": "pendiente", "es_invitado": false,
  "cliente_nombre": "Ada", "cliente_apellido": "Lovelace", "cliente_telefono": "3000000000",
  "barbero_nombre": "Grace", "barbero_apellido": "Hopper",
  "servicio_nombre": "Corte Clásico", "precio": "15.00", "duracion_minutos": 30 }
```

**Reserva manual (walk-in):** `administrador` y `barbero` pueden agendar para cualquier
`clienteID` registrado o, **sin `clienteID`**, una cita de invitado pasando
`contacto_nombre` y `contacto_telefono` (mínimo 7 dígitos); el `clienteID` queda `null`
y la cita aparece como `es_invitado`. Un `cliente` solo puede agendar para sí mismo
(`403` si manda otro `clienteID`).


> Las fechas van y vienen como hora local **sin zona** (`YYYY-MM-DDTHH:MM:SS`, sin
> `Z`): es la hora de pared del negocio. Las citas nuevas ya no se desplazan por
> conversión a UTC.

### Reserva de invitado (sin cuenta)

`POST /api/citas/publica` agenda **sin crear ningún usuario**: guarda el contacto del
invitado en la propia cita (`clienteID` queda `null`, con `contacto_nombre` y
`contacto_telefono`) y devuelve un **`codigo`** (JWT de gestión, 30 días) para ver y
cancelar la cita sin sesión.

```jsonc
// POST /api/citas/publica
{ "nombre": "Ada", "apellido": "Lovelace", "telefono": "3000000000",
  "barberoID": 1, "servicioID": 1, "fecha_hora": "2026-10-05T10:00:00" }

// respuesta 201 — `codigo` se usa en /api/citas/publica/:codigo
{ "ok": true, "message": "Cita agendada exitosamente", "codigo": "eyJhbGciOi...",
  "cita": { "citaID": 1, "clienteID": null, "contacto_nombre": "Ada Lovelace",
    "contacto_telefono": "3000000000", "estado": "pendiente",
    "fecha_inicio": "2026-10-05T10:00:00", "fecha_fin": "2026-10-05T10:30:00" } }
```

| Endpoint | Cuándo |
|---|---|
| `GET /api/citas/publica/:codigo` | Ver la cita (devuelve `cita` con `es_invitado`) |
| `PUT /api/citas/publica/:codigo/estado` | **Solo cancela** (un body `estado` se ignora) |

Un `codigo` inválido o expirado responde `401`.

Cuando un invitado **se registra con el mismo teléfono**, sus citas de invitado quedan
vinculadas a la nueva cuenta (`POST /api/usuarios` devuelve `citasVinculadas`) y pasan
a verse en `GET /api/citas` como cualquier otra.

`GET /api/citas/ocupados?barberoID=1&desde=2026-10-05&hasta=2026-10-06` devuelve solo
las horas ocupadas (`fecha_inicio`/`fecha_fin`) de un barbero, sin datos del cliente:
es público, para que el wizard de reserva calcule cupos libres sin sesión. El parámetro
opcional `&excluir=<citaID>` deja fuera una cita concreta (la que se está reprogramando)
para que su antigua hora no aparezca ocupada. No es una medida de seguridad: el servidor
revalida el solape al guardar.



**La hora de fin la calcula el servidor** a partir de `duracion_minutos` del servicio.
No se envía.

**Al agendar se valida, en este orden:**

1. El barbero existe y está activo.
2. El servicio existe.
3. El barbero tiene horario configurado para **ese día de la semana**.
4. La cita completa dentro de ese horario (empieza después de `hora_inicio` y
   termina antes de `hora_fin`).
5. No se solapa con otra cita del mismo barbero. Las canceladas no bloquean.

| Error | Cuándo |
|---|---|
| `400` | El barbero no tiene horario para ese día, o la cita cae fuera del horario |
| `400` | Se solapa con otra cita |
| `400` | El barbero no está activo |
| `400` | La cita cruzaría la medianoche |
| `404` | El barbero o el servicio no existen |

### Estados de una cita

`pendiente` → `confirmada` → `completada`, o → `cancelada` en cualquier momento.
**El servidor no impone el orden**: acepta cualquiera de los cuatro. La validación
vive en el frontend.

```jsonc
// PUT /api/citas/:id/estado
{ "estado": "confirmada" }
```

El `administrador` y el `barbero` pueden mover la cita por cualquier transición. El
`cliente` **solo puede cancelar su propia cita**: cualquier otro `estado`, o una cita
ajena, responde `403`.

Un `401` significa token ausente o expirado. Un `403` significa rol insuficiente.

### Reprogramar una cita

`PUT /api/citas/:id` cambia **solo la fecha y hora** (mantiene barbero y servicio). El
cliente solo puede reprogramar **las suyas** y solo si siguen `pendiente` o
`confirmada`; el administrador cualquiera en ese mismo rango.

```jsonc
// PUT /api/citas/5
{ "fecha_hora": "2026-12-08T09:00:00" }
```

Se revalidan el horario del barbero y el solape, **excluyendo la propia cita** (por eso
reprogramar al mismo horario también funciona). Un solape con otra cita responde `400`.

| Código | Cuándo |
|---|---|
| `400` | `id` no numérico, falta `fecha_hora`, cita fuera de horario, solape, o estado no reprogramable |
| `401` | Sin token |
| `403` | Rol distinto de `administrador`/`cliente`, o la cita no es del cliente |
| `404` | La cita no existe |

> El barbero no puede reprogramar (`403`): solo el admin y el dueño de la cita.

---

## Pagos

`transacciones` almacena el pago de una **cita** (migración 011). Hay tres métodos:

- **`pago_movil`**: lo sube el cliente con el comprobante (imagen + referencia) y queda
  **`pendiente`** hasta que el administrador lo aprueba o rechaza.
- **`efectivo`** / **`tarjeta`**: los registra el administrador en el local y quedan
  **`completado`** directamente.

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/transacciones` | `administrador` (todas) / `cliente` (las suyas) | `{ ok, total, transacciones: [...] }` |
| `GET` | `/api/transacciones/:id` | `administrador` / `cliente` (dueño) | `{ ok, transaccion }` |
| `POST` | `/api/transacciones` | `administrador` / `cliente` (pago móvil propio) | `{ ok, message, transaccion }` · `201` |
| `PUT` | `/api/transacciones/:id/aprobar` | **`administrador`** | `{ ok, message, transaccion }` |
| `PUT` | `/api/transacciones/:id/rechazar` | **`administrador`** | `{ ok, message, transaccion }` |

Filtros opcionales en `GET`: `?estado=pendiente|completado|rechazado`
`&metodo_pago=pago_movil|efectivo|tarjeta`.

`POST /api/transacciones` acepta `multipart/form-data` (campo **`comprobante`**) para el
pago móvil del cliente, o JSON para el pago presencial del administrador:

```jsonc
// pago móvil (cliente) — multipart
//   citaID=1  metodo_pago=pago_movil  referencia_pago=00123456
//   comprobante=<archivo JPG/PNG/WEBP/GIF, máx 5 MB>
// efectivo/tarjeta (admin) — JSON
{ "citaID": 1, "metodo_pago": "efectivo", "referencia_pago": "Caja 12", "monto": 15 }

// respuesta (datos abreviados)
{ "ok": true, "message": "Pago registrado exitosamente",
  "transaccion": { "transaccionID": 3, "citaID": 1, "usuarioID": 7,
    "monto": "15.00", "metodo_pago": "efectivo", "estado": "completado",
    "comprobante_url": null, "referencia_pago": "Caja 12", "motivo_rechazo": null,
    "cliente_nombre": "Ana", "servicio_nombre": "Corte Clásico",
    "fecha_inicio": "2026-11-03T10:00:00", "fecha_creacion": "..." } }
```

Reglas:

- `monto` es opcional: si se omite se usa el `precio` del servicio de la cita.
- `pago_movil` exige `comprobante` (la imagen) y `referencia_pago`.
- Solo el administrador registra `efectivo`/`tarjeta` (si no, `403`).
- El cliente solo paga **sus propias** citas (`403` si no) y no puede pagar una cita
  `cancelada`.
- Un pago **vigente** por cita: no se puede volver a pagar mientras el último no esté
  `rechazado` (`409`).
- `aprobar`/`rechazar` solo sobre pagos `pendiente` (`409` en otro caso). El cuerpo de
  `rechazar` acepta `{ "motivo": "..." }` (opcional).
- El `comprobante_url` se sirve como estático en `/uploads/...`.
- Las citas devueltas por `GET /api/citas` incluyen `pago_estado` y `pago_metodo` de su
  último pago (o `null`).

---

## Estadísticas

| Método | Ruta | Auth | Devuelve |
|---|---|---|---|
| `GET` | `/api/estadisticas/resumen` | **`administrador`** | `{ ok, generadoEn, resumen, ... }` |

Resumen de negocio para el dashboard. Todo se calcula al vuelo a partir de `cita`,
`servicios` y `barbero`; `cliente`/`barbero` sin token o con otro rol reciben
`401`/`403`.

```jsonc
// respuesta 200 (abreviada)
{
  "ok": true,
  "generadoEn": "2026-10-12T18:00:00.000Z",
  "resumen": {
    "citasTotales": 9, "citasHoy": 2, "citasProximas": 5,
    "citasCompletadas": 1, "citasCanceladas": 3,
    "ingresosCompletadas": "15.00", "ingresosMes": "15.00",
    "ticketPromedio": "15.00",
    "clientesTotales": 4, "barberosActivos": 3, "serviciosTotales": 6
  },
  "citasPorEstado": [{ "estado": "pendiente", "total": 4 }],
  "citasUltimos14Dias": [{ "fecha": "2026-10-12", "total": 2 }],
  "topServicios": [{ "servicioID": 1, "nombre": "Corte Clásico", "total": 4, "ingresos": "15.00" }],
  "rankingBarberos": [{ "barberoID": 1, "nombre": "Grace", "apellido": "Hopper",
    "comision": "20.00", "estado": true, "citas": 3, "ingresos": "15.00",
    "comisionEstimada": 3 }],
  "ingresosPorMes": [{ "mes": "2026-10", "ingresos": "15.00", "citas": 1 }]
}
```

- Los ingresos usan el `precio` del servicio y cuentan solo las citas **`completada`**.
- `comisionEstimada` = `ingresos × comision / 100`.
- `citasUltimos14Dias` cubre 14 días (incluye hoy, con 0 si no hay citas);
  `ingresosPorMes` cubre 6 meses.

---

## Errores

| Código | Significado |
|---|---|
| `400` | Solicitud inválida o conflicto de negocio (datos faltantes, correo duplicado, barbero repetido, cita solapada o fuera de horario) |
| `401` | Sin autenticación: token ausente, inválido o expirado |
| `403` | Autenticado pero sin permiso (rol insuficiente) |
| `404` | Ruta o recurso inexistente |
| `429` | Demasiados intentos en `/api/auth/login` o `/api/auth/recuperar` |
| `500` | Error interno del servidor |

Las rutas inexistentes devuelven 404 en JSON:

```json
{ "ok": false, "message": "Recurso no encontrado" }
```

---

## Lo que falta para un panel de administración

| Módulo | Falta |
|---|---|
| Servicios | — (ya tiene `POST`, `PUT` y `DELETE`) |
| Barberos | `DELETE /api/barberos/:id` |
| Reseñas | — (moderación/borrado por el administrador ya están) |
| Citas | `GET /api/citas/:id`, `DELETE /api/citas/:id` |
| Reserva manual | — (`POST /api/citas` acepta walk-in y agendar para otro cliente si el token es de staff) |
| Horarios | `PUT` (se resuelve con otro `POST`, es un upsert) |
| Transacciones | — (pago por cita, aprobar/rechazar y detalle ya están) |
| Auth | `POST /api/auth/logout` (la recuperación de contraseña ya está en `/api/auth/recuperar`) |
| Estadísticas | Filtros por rango de fechas / barbero en `/api/estadisticas/resumen` |

**Usuarios** tiene el CRUD completo; **barberos** ya admite edición de perfil y foto,
y **citas** ya cubre reserva pública, gestión por código y contadores por rol.