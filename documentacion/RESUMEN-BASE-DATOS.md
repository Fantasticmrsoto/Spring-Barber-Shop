# Resumen de la Base de Datos — Spring Barber Shop

> Documento generado a partir de la base de datos real (`barberia` en PostgreSQL),
> del código del proyecto (`backend/`) y del *Informe del Sistema de Datos*
> (`InformeSisDatos.docx`).
> **Alcance: únicamente la base de datos.** No se cubre el frontend, los endpoints
> ni la lógica de negocio más allá de lo que la base impone.

---

## 1. Panorama general

| Aspecto | Realidad |
|---|---|
| Motor | **PostgreSQL 18.6** |
| Base de datos | `barberia` |
| Esquema | `public` |
| Tipo | Relacional, normalizada en 3FN |
| Tablas | **9** (8 del negocio + 1 de control de migraciones) |
| Idioma | Español en nombres de tablas y columnas (`usuario`, `servicios`, `cita`) |
| Migraciones | `backend/migrations/000…007`, idempotentes y registradas en `schema_migrations` |

**Idea general:** la base guarda quién entra al sistema (`usuario`), a quién se le
contrata como barbero (`barbero`), qué se ofrece (`servicios`), qué días trabaja
cada barbero (`horario_laboral`), cuándo no se abre (`feriado`), qué servicios
atiende cada uno (`barbero_servicio`), las reservas (`cita`) y el libro de saldo
(`transacciones`).

---

## 2. Las tablas, en palabras sencillas

### 2.1 `usuario` — las personas de la casa (33 filas)

La tabla central. Guarda **administradores, barberos y clientes** en la misma
tabla, separados por el campo `rol`.

| Campo | Tipo | Reglas | Qué guarda |
|---|---|---|---|
| `usuarioID` | serial | PK | Número único y consecutivo |
| `nombre` | text | NOT NULL | Nombre |
| `apellido` | text | NOT NULL | Apellido |
| `correo` | text | UNIQUE, NOT NULL | Es el **usuario de acceso** al sistema |
| `telefono` | text | NOT NULL | Contacto (también sirve para WhatsApp) |
| `clave` | text | NOT NULL | Contraseña **encriptada con bcrypt** (10 rondas) |
| `rol` | text | NOT NULL | `cliente`, `barbero` o `administrador` |

`correo` es UNIQUE: una persona solo puede tener una cuenta. No hay CHECK sobre
`rol`, así que el valor se valida en el código, no en la base.

### 2.2 `barbero` — el perfil profesional (15 filas)

Extensión de `usuario`: añade lo que **solo** tiene un barbero.

| Campo | Tipo | Reglas | Qué guarda |
|---|---|---|---|
| `barberoID` | serial | PK | Identificador del barbero |
| `usuarioID` | integer | FK → `usuario`, UNIQUE | Su cuenta de usuario (1:1) |
| `comision` | numeric(5,2) | NOT NULL | Porcentaje que se lleva, p. ej. `30.00` = 30 % |
| `estado` | boolean | NOT NULL | `true` = activo, `false` = inactivo |

El UNIQUE en `usuarioID` garantiza que un usuario no sea barbero dos veces.
`estado` es el interruptor que apaga a un barbero sin borrar su historial.

### 2.3 `servicios` — el catálogo de precios (17 filas)

| Campo | Tipo | Reglas | Qué guarda |
|---|---|---|---|
| `serviciosID` | serial | PK | Identificador |
| `nombre` | text | NOT NULL | Ej. "Corte clásico" |
| `descripcion` | text | NOT NULL | Qué incluye |
| `precio` | numeric(10,2) | NOT NULL | Precio en el moneda local |
| `duracion_minutos` | integer | NOT NULL | Tiempo estimado (30, 45, 20…) |

`duracion_minutos` es el dato que permite calcular sola la hora de fin de una
cita: **la base no guarda la duración, la deduce del servicio.**

### 2.4 `barbero_servicio` — qué sabe hacer cada barbero (17 filas)

Tabla puente **N:M** entre `barbero` y `servicios`: un barbero puede ofrecer
varios servicios y un servicio puede ser offered por varios barberos.

| Campo | Tipo | Reglas |
|---|---|---|
| `barbero_servicioID` | serial | PK |
| `barberoID` | integer | FK → `barbero`, NOT NULL |
| `servicioID` | integer | FK → `servicios`, NOT NULL |

El par `(barberoID, servicioID)` es **UNIQUE**: nadie ofrece dos veces el mismo
servicio. Es lo que permite que, al agendar una cita, la web solo ofrezca los
servicios asignados a ese barbero.

### 2.5 `horario_laboral` — la agenda semanal (20 filas)

Define, **día por día**, en qué franja trabaja cada barbero.

| Campo | Tipo | Reglas | Qué guarda |
|---|---|---|---|
| `horarioID` | serial | PK | Identificador |
| `barberoID` | integer | FK → `barbero`, NOT NULL | A quién pertenece |
| `dia_semana` | text | CHECK (7 valores) | `lunes` … `domingo`, en minúsculas y sin tilde |
| `hora_inicio` | time | NOT NULL | Ej. `09:00:00` |
| `hora_fin` | time | NOT NULL | Ej. `18:00:00` |

Reglas dura del modelo:
- `UNIQUE (barberoID, dia_semana)` → **una franja por barbero y día**. Esto es lo
  que permite que al guardar un horario se **actualice** en vez de duplicar.
- `CHECK (hora_fin > hora_inicio)` → nunca una franja invertida (18:00 → 09:00).
- `CHECK` de los 7 días → no se puede escribir "lunex" ni "Lunes".

### 2.6 `feriado` — los días cerrados (24 filas)

| Campo | Tipo | Reglas | Qué guarda |
|---|---|---|---|
| `fecha` | date | PK | El día exacto |
| `nombre` | text | NOT NULL | Ej. "Batalla de Carabobo" |
| `tipo` | text | CHECK, DEFAULT `festivo` | `festivo`, `religioso` o `carnaval` |

Cargada con los feriados=de Venezuela de **2026 y 2027**. El domingo no está
aquí: se deduce del día de la semana (es el día de descanso fijo). Los tipos
separan los fijos de los que se mueven con la Pascua, porque el Carnaval y la
Semana Santa cambian de fecha cada año.

### 2.7 `cita` — el corazón del sistema (20 filas)

La reserva. Una fila es **un cliente + un barbero + un servicio + un bloque de
tiempo**.

| Campo | Tipo | Reglas | Qué guarda |
|---|---|---|---|
| `citaID` | serial | PK | Identificador |
| `clienteID` | integer | FK → `usuario`, NOT NULL | Quién reserva |
| `barberoID` | integer | FK → `barbero`, NOT NULL | Quién atiende |
| `servicioID` | integer | FK → `servicios`, NOT NULL | Qué se hace |
| `fecha_inicio` | timestamp | NOT NULL | Cuándo empieza |
| `fecha_fin` | timestamp | NOT NULL | Cuándo termina (calculada) |
| `estado` | text | CHECK, DEFAULT `pendiente` | `pendiente`, `confirmada`, `completada`, `cancelada` |
| `codigo` | text | UNIQUE parcial (no nulo) | Clave de gestión de una cita de invitado (24 caracteres hex) |

`fecha_fin` se calcula como `fecha_inicio + duracion_minutos` del servicio.
El CHECK del estado es la garantía de que nunca aparezca un estado inventado.

`codigo` (migración 009) es lo único que un invitado sin cuenta puede presentar
para ver o cancelar su cita: la web le devuelve el enlace `/cita/<codigo>`. Las
citas con cuenta lo tienen a `NULL`.

### 2.8 `transacciones` — el libro de saldo (14 filas)

Un **libro de movimientos**, no un registro de pagos por cita. Cada fila es un
movimiento de saldo de un usuario.

| Campo | Tipo | Reglas | Qué guarda |
|---|---|---|---|
| `transaccionID` | serial | PK | Identificador |
| `usuarioID` | integer | FK → `usuario`, NOT NULL | De quién es el saldo |
| `tipo_movimiento` | text | NOT NULL | Ej. `recarga` |
| `monto` | numeric(10,2) | NOT NULL | Cuánto entró o salió |
| `saldo_restante` | numeric(10,2) | NOT NULL | Saldo después del movimiento |
| `referencia_pago` | text | NOT NULL | Comprobante / referencia (Ej. `PAG-E2E-001`) |
| `fecha_creacion` | timestamp | DEFAULT NOW(), NOT NULL | Cuándo se registró |

`saldo_restante` guarda la foto del saldo tras cada movimiento: con eso, el
saldo actual se lee con la última fila del usuario sin recalcular nada.

### 2.9 `schema_migrations` — el control de cambios (8 filas)

| Campo | Tipo | Reglas |
|---|---|---|
| `nombre` | text | PK |
| `aplicada_en` | timestamp | DEFAULT NOW(), NOT NULL |

No es del negocio: es el libro de registro de qué migraciones se aplicaron. Sirve
para que un despliegue nuevo aplique solo lo que falta y para no volver a
aplicar lo mismo.

---

## 3. Cómo se relacionan las tablas

```
usuario ──┬──< cita >────┬── barbero ──< barbero_servicio >── servicios
          │              │      │                               │
          │              │      └──< horario_laboral            │
          │              │                                     │
          └──< transacciones                                  │
                                                              │
                      usuario ────────────────────────────────┘
                              (cita → servicios)
```

- `usuario` 1:N `cita` (un cliente, muchas citas; un barbero, muchas citas)
- `barbero` 1:1 `usuario` (extensión, no tabla independiente)
- `barbero` 1:N `cita`, `barbero` 1:N `horario_laboral`
- `servicios` N:M `barbero` (a través de `barbero_servicio`)
- `servicios` 1:N `cita`
- `usuario` 1:N `transacciones`
- `feriado` → tabla de referencia suelta, se consulta por fecha

**Todas las llaves foráneas usan `ON UPDATE CASCADE ON DELETE CASCADE`**: si se
borra un barbero, se borran sus citas, sus horarios y sus asignaciones de
servicio, sin dejar basura colgando.

---

## 4. Reglas de integridad (lo que la base impide)

| Tipo | Regla | Dónde |
|---|---|---|
| PK | Clave primaria en las 8 tablas del negocio | todas |
| UNIQUE | `usuario.correo` | 1 usuario = 1 cuenta |
| UNIQUE | `barbero.usuarioID` | 1 usuario = 1 barbero |
| UNIQUE | `horario_laboral(barberoID, dia_semana)` | 1 franja por barbero y día |
| UNIQUE | `barbero_servicio(barberoID, servicioID)` | 1 servicio por barbero |
| UNIQUE | `feriado.fecha` | 1 feriado por día |
| CHECK | `cita.estado` ∈ 4 valores | ciclo de vida de la cita |
| CHECK | `horario_laboral.dia_semana` ∈ 7 días | dominio de días |
| CHECK | `horario_laboral.hora_fin > hora_inicio` | franja válida |
| CHECK | `feriado.tipo` ∈ 3 valores | tipo de feriado |
| FK | 8 relaciones | integridad referencial |

Las 4 reglas `UNIQUE` no vinieron gratis: las migraciones `003`, `004` y `005`
las añadieron porque el código ya las asumía y sin ellas los `INSERT ... ON
CONFLICT` del backend nunca detectaban el conflicto (PostgreSQL devolvía
`42P10`). Lo mismo con las FKs (migración `002`): sin ellas la base aceptaba
citas de clientes, barberos o servicios inexistentes.

---

## 5. La regla de oro: no hay doble reserva

Este es el problema real del negocio (el *double-booking* que menciona el
informe) y la base lo resuelve por partida doble:

1. **Bloqueo pesimista.** La reserva se hace dentro de una transacción que
   empieza con `SELECT ... FOR UPDATE` sobre la fila del barbero. Si dos
   personas pulsan "reservar" a la vez, la segunda **espera** a que la primera
   termine, en lugar de leer datos viejos.

2. **Consulta de solapamiento.** Dentro de esa misma transacción se comprueba
   que no exista otra cita del mismo barbero que se cruce en el tiempo:

   ```sql
   SELECT "citaID", fecha_inicio, fecha_fin
   FROM cita
   WHERE "barberoID" = $1
     AND estado <> 'cancelada'
     AND fecha_inicio < $3
     AND fecha_fin   > $2;
   ```

   Si hay coincidencia, la cita se rechaza con **HTTP 409 (Conflicto)**.

3. **Reglas de calendario.** Antes de insertar se verifican, en la misma
   transacción, que no sea domingo (`domingo` es día de descanso fijo), que no
   sea feriado (tabla `feriado`) y que la franja esté dentro del
   `horario_laboral` de ese barbero para ese día.

Todo eso ocurre **dentro de una transacción ACID**: o se guarda la cita
completa, o no se guarda nada.

---

## 6. Volumen de datos actual

| Tabla | Filas | Contenido |
|---|---|---|
| `usuario` | 33 | 17 clientes, 15 administradores, 1 barbero |
| `barbero` | 15 | 1 barbero real (Carlos Navas, 30 %) + 14 de pruebas E2E |
| `servicios` | 17 | 3 del catálogo real + 14 duplicados "Corte Clásico" de las pruebas |
| `cita` | 20 | 6 pendientes, 14 confirmadas (ninguna completada ni cancelada) |
| `horario_laboral` | 20 | 6 días (lunes–sábado) para el barbero real |
| `barbero_servicio` | 17 | Asignaciones barbero ↔ servicio |
| `feriado` | 24 | Feriados de Venezuela 2026–2027 |
| `transacciones` | 14 | Recargas de 100.00 de las pruebas E2E |
| `schema_migrations` | 8 | Las 8 migraciones aplicadas |

> La base de desarrollo está **contaminada con datos de las pruebas
> automatizadas** (14 administradores `admin_<timestamp>@barberia.com`, 14
> servicios duplicados "Corte Clásico" a 15.00 y 14 recargas `PAG-E2E-001`).
> Para una demostración o un informe hay que usar esos números con cuidado o
> limpiar con `TRUNCATE`.

---

## 7. Consultas del proyecto contra la base

### 7.1 Simples (CRUD y filtros)

| Propósito | SQL |
|---|---|
| Catálogo de servicios | `SELECT * FROM servicios;` |
| Login (por correo) | `SELECT * FROM usuario WHERE correo = $1;` |
| Barberos activos | `SELECT * FROM barbero WHERE estado = true;` |
| Una cita | `SELECT * FROM cita WHERE "citaID" = $1;` |
| Cancelar cita | `UPDATE cita SET estado = 'cancelada' WHERE "citaID" = $1;` |
| Citas de un cliente | `SELECT * FROM cita WHERE "clienteID" = $1;` |
| Agenda de un barbero (un día) | `SELECT * FROM cita WHERE "barberoID" = $1 AND fecha_inicio::date = $2;` |
| Horario de un barbero | `SELECT * FROM horario_laboral WHERE "barberoID" = $1;` |
| Servicios de un barbero | `SELECT * FROM barbero_servicio WHERE "barberoID" = $1;` |
| Feriados | `SELECT * FROM feriado ORDER BY fecha;` |

### 7.2 Complejas (lógica de negocio y reportes)

Son las que alimentan el panel de administración:

| Reporte | Cómo se calcula |
|---|---|
| **Control de solapamiento** | `cita` con `fecha_inicio < :fin AND fecha_fin > :inicio` + `FOR UPDATE` |
| **Ingresos del mes** | `SUM(servicios.precio)` sobre citas `completada` del mes |
| **Top servicios** | `GROUP BY servicios.nombre ORDER BY COUNT(*) DESC` |
| **Ranking de barberos** | `COUNT(cita)` por barbero + comisión estimada |
| **Tasa de cancelación** | `COUNT(estado='cancelada') / COUNT(*)` por cliente |
| **Promedio de duración** | `AVG(fecha_fin - fecha_inicio)` por barbero |
| **Ocupación diaria** | `COUNT(*)` por `fecha_inicio::date` (14 días) |
| **Clientes recurrentes** | Clientes con `> 3` citas confirmadas |
| **Ingresos por mes** | `to_char(fecha_inicio, 'YYYY-MM')` + `SUM(precio)` |
| **Disponibilidad** | Franja de `horario_laboral` menos las citas ya ocupadas |

---

## 8. Cómo se construye y actualiza la base

Las migraciones viven en `backend/migrations/` y se aplican **solas al arrancar
el servidor** (`AUTO_MIGRATE`), o a mano con `npm run migrate`.

| # | Migración | Qué resuelve |
|---|---|---|
| 000 | `esquema_base` | Crea el esquema completo desde cero (idempotente) |
| 001 | `agregar_estado_cita` | Añade `cita.estado` + backfill + CHECK de 4 valores |
| 002 | `llaves_foraneas` | Las 8 FKs con `CASCADE` |
| 003 | `constraints_unique` | UNIQUE en `usuario.correo` y `barbero.usuarioID` |
| 004 | `modulo_horario_laboral` | UNIQUE por barbero+día, CHECK de días y de rango |
| 005 | `modulo_barbero_servicio` | UNIQUE del par barbero-servicio |
| 006 | `modulo_transacciones` | `fecha_creacion` NOT NULL con DEFAULT `now()` |
| 007 | `dias_no_laborables` | Tabla `feriado` + 24 feriados VE 2026–2027 |
| 008 | `datos_del_panel_admin` | Columnas que el panel del administrador necesita (`transacciones.citaID`, `metodo_pago`, `estado`, `comprobante_url`, `motivo_rechazo`, `cita.es_invitado`, `contacto_nombre`, `contacto_telefono`) |
| 009 | `codigo_cita_publica` | `cita.codigo` + índice único parcial: el código con el que un invitado ve y cancela su cita sin cuenta |
| 010 | `pago_al_reservar` | `cita.pago_metodo`, `cita.pago_estado`, `cita.motivo_pago`; añade `denegada` al estado de cita; CHECKs del pago; rellena datos desde `transacciones` |

Dos detalles que muestran el cuidado del diseño:

- **La 000 existe porque antes las tablas se creaban a mano.** Sin ella, un
  clon limpio del repositorio fallaba con `relation "public.cita" does not
  exist`.
- **Cada migración verifica datos sucios antes de aplicar su constraint**
  (huérfanos, duplicados) y lanza un error descriptive si los encuentra, en vez
  de fallar a mitad de camino.

Los datos iniciales (`npm run seed`) son idempotentes: 3 servicios reales
(Corte clásico 25.000/30 min, Fade premium 32.000/45 min, Arreglo de barba
18.000/20 min), 1 administrador, 1 barbero y 1 cliente de ejemplo.

---

## 9. Diferencias entre el informe y la base real

El *Informe del Sistema de Datos* describe un modelo **más grande** que el que
existe en la base. Estas son las diferencias que hay que tener presentes:

| En el informe | En la base real |
|---|---|
| Nombres en inglés: `USERS`, `SERVICES`, `APPOINTMENTS` | En español: `usuario`, `servicios`, `cita` |
| Claves `UUID` generadas automáticamente | Claves `serial` (enteros autoincrementales) |
| `TIMESTAMP WITH TIME ZONE` | `timestamp without time zone` (y `time without time zone` en `horario_laboral`) |
| `cita.clienteID` **NULLABLE** + `contacto_nombre` + `contacto_telefono` (citas de invitados) | **No existen.** `clienteID` es NOT NULL → hoy no se pueden guardar citas de walk-in |
| `transacciones` con `citaID`, `metodo_pago`, `estado`, `comprobante_url`, `motivo_rechazo` | Es un libro de saldo: `tipo_movimiento`, `saldo_restante`, `referencia_pago`. **Sin `citaID`, sin método de pago, sin estado, sin comprobante** |
| Tabla `RESEÑA` (calificación, comentario) | **No existe** en la base |
| — | **Sí existen y el informe no las menciona:** `barbero`, `barbero_servicio`, `horario_laboral`, `feriado`, `schema_migrations` |
| Roles `CLIENT`, `BARBER`, `ADMIN` | `cliente`, `barbero`, `administrador` (español, minúsculas) |
| Estados `PENDING`, `CONFIRMED`, `CANCELLED` | `pendiente`, `confirmada`, `completada`, `cancelada` (4, no 3) |

**Consecuencias practices:**

1. **Las consultas del apartado 5 del informe no se pueden copiar tal cual.**
   Usan `users`, `appointments`, `status = 'CANCELLED'`, `role = 'BARBER'`, etc.
   Hay que traducirlas a los nombres reales: `usuario`, `cita`,
   `estado = 'cancelada'`, `rol = 'barbero'`.

2. **El panel de administración del frontend pide cosas que la base no tiene.**
   La sección "Pagos" del panel lee `transacciones.metodo_pago`,
   `.comprobante_url`, `.motivo_rechazo` y `.estado`, y llama a
   `PUT /api/transacciones/:id/aprobar` y `/rechazar`; la pestaña "Reseñas"
   llama a `/api/barberos/:id/resenas`; el "Resumen" llama a
   `/api/estadisticas/resumen`. **Ninguna de esas rutas existe en el backend
   actual y ninguna de esas columnas existe en la base.**

   Además, la página de perfil del barbero (`PanelBarbero.jsx`) edita
   `descripcion`, `especialidad`, `instagram` y `foto_url`, y el formulario de
   cita manual del panel manda `contacto_nombre` y `contacto_telefono` para
   los invitados. **Ninguna de esas columnas existe hoy.** En total, el frontend
   espera **11 columnas y 1 tabla que la base no tiene**:

   | Falta en la base | Lo que el frontend espera | Dónde |
   |---|---|---|
   | `transacciones.citaID` | Vincular el pago a una cita | módulo de pagos |
   | `transacciones.metodo_pago` | `efectivo` / `tarjeta` / `pago_movil` | módulo de pagos |
   | `transacciones.estado` | `pendiente` / `completado` / `rechazado` | módulo de pagos |
   | `transacciones.comprobante_url` | Ruta de la imagen del comprobante | módulo de pagos |
   | `transacciones.motivo_rechazo` | Motivo del rechazo | módulo de pagos |
   | tabla `resena` | `resenaID`, `barberoID`, `usuarioID`, `calificacion`, `comentario`, `fecha_creacion` | pestaña Reseñas |
   | `barbero.foto_url` | Foto de perfil | perfil del barbero |
   | `barbero.especialidad` | Ej. "Fade, barba" | perfil del barbero |
   | `barbero.instagram` | @usuario | perfil del barbero |
   | `barbero.descripcion` | Descripción del estilo | perfil del barbero |
   | `cita.contacto_nombre` | Nombre del invitado | cita manual |
   | `cita.contacto_telefono` | Teléfono del invitado | cita manual |

   Además, `POST /api/transacciones` del frontend manda `{citaID, metodo_pago,
   referencia_pago, monto, comprobante}` mientras que el backend espera
   `{usuarioID, tipo_movimiento, monto, saldo_restante, referencia_pago}`: los
   dos cuerpos **no son compatibles**, así que hoy el formulario de pagos del
   panel no puede funcionar contra esta base.

3. **El bloqueo pesimista sí está implementado** (`FOR UPDATE` en
   `citaController.js`), pero **no hay un índice sobre `cita(barberoID,
   fecha_inicio)`**. Con muchas citas, la comprobación de solapamiento
   recorre la tabla entera. Es el índice que más conviene añadir si el volumen
   crece.

4. **Los `timestamp` sin zona horaria** obligan a que el servidor y la base
   trabajen siempre en la misma hora local. Funciona, pero en un despliegue en
   la nube (Neon, Render) es una fuente clásica de desajustes de una hora.
   Usar `timestamptz` sería más robusto.

---

## 10. Brechas y cómo cerrarlas

Todo lo que sigue son cambios **de esquema**, no de lógica. Cada uno cabe en
una migración nueva (`008_…sql`) porque el runner es idempotente y se aplican
solas al arrancar.

### 10.1 Cerrar el módulo de pagos

Hoy `transacciones` es un libro de saldo y el panel de administración espera un
registro de pagos por cita. Son dos cosas distintas. La opción que menos toca
el código existente es **agregar las columnas que faltan y_nullable**:

```sql
ALTER TABLE public.transacciones
    ADD COLUMN IF NOT EXISTS "citaID" integer,
    ADD COLUMN IF NOT EXISTS metodo_pago text,
    ADD COLUMN IF NOT EXISTS comprobante_url text,
    ADD COLUMN IF NOT EXISTS motivo_rechazo text;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='transacciones_estado_check') THEN
        ALTER TABLE public.transacciones ADD CONSTRAINT transacciones_estado_check
            CHECK (estado IS NULL OR estado IN ('pendiente','completado','rechazado'));
    END IF;
END $$;
```

Y la FK opcional hacia `cita`, con su índice:

```sql
ALTER TABLE public.transacciones
    ADD CONSTRAINT fk_transaccion_cita FOREIGN KEY ("citaID")
        REFERENCES public.cita ("citaID") ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacciones_cita ON public.transacciones ("citaID");
```

> Ojo: `ON DELETE SET NULL` y no `CASCADE`, porque si se borra una cita no
> debe desaparecer el registro financiero.

### 10.2 Cerrar las citas de invitados

Para admitir walk-ins (lo que el informe y el formulario del panel ya manejan)
hay que **relajar el NOT NULL** de `clienteID` y añadir los dos campos de
contacto:

```sql
ALTER TABLE public.cita ALTER COLUMN "clienteID" DROP NOT NULL;
ALTER TABLE public.cita ADD COLUMN IF NOT EXISTS contacto_nombre text;
ALTER TABLE public.cita ADD COLUMN IF NOT EXISTS contacto_telefono text;
```

Y un CHECK que garantice que siempre haya alguien a quien preguntarle:

```sql
ALTER TABLE public.cita ADD CONSTRAINT cita_contacto_check
    CHECK ("clienteID" IS NOT NULL OR (contacto_nombre IS NOT NULL AND contacto_telefono IS NOT NULL));
```

### 10.3 Cerrar las reseñas

```sql
CREATE TABLE IF NOT EXISTS public.resena (
    "resenaID"   serial PRIMARY KEY,
    "barberoID"  integer NOT NULL REFERENCES public.barbero ("barberoID") ON DELETE CASCADE,
    "usuarioID"  integer NOT NULL REFERENCES public.usuario ("usuarioID") ON DELETE CASCADE,
    calificacion numeric(2,1) NOT NULL CHECK (calificacion >= 0.5 AND calificacion <= 5.0),
    comentario   text,
    fecha_creacion timestamp(0) without time zone NOT NULL DEFAULT now(),
    CONSTRAINT resena_unica UNIQUE ("barberoID", "usuarioID")
);
```

El `UNIQUE (barberoID, usuarioID)` hace que un cliente solo pueda dejar **una**
reseña por barbero — que es justo lo que el frontend ya asume cuando edita la
reseña existente.

### 10.4 Cerrar el perfil del barbero

```sql
ALTER TABLE public.barbero
    ADD COLUMN IF NOT EXISTS foto_url text,
    ADD COLUMN IF NOT EXISTS descripcion text,
    ADD COLUMN IF NOT EXISTS especialidad text,
    ADD COLUMN IF NOT EXISTS instagram text;
```

### 10.5 Índices que conviene añadir ya

| Índice | Para qué |
|---|---|
| `cita(barberoID, fecha_inicio)` | La comprobación de solapamiento; hoy es la consulta más pesada |
| `cita("clienteID")` | "Mis citas" del cliente |
| `cita(estado)` | Reportes por estado del panel |
| `servicios(nombre)` | Búsqueda del catálogo |
| `transacciones("usuarioID", fecha_creacion DESC)` | Historial de saldo del usuario |

### 10.6 Si se decide seguir el informe al pie de la letra

En lugar de *añadir* columnas, se puede **rehacer** el esquema con nombres en
inglés, `uuid` y `timestamptz`. Es lo que el informe describe. Pero:

- Implica renombrar 8 tablas y ~40 columnas, y tocar **todas** las consultas
  del backend, del seed y de las migraciones ya aplicadas.
- Las migraciones aplicadas quedan registradas en `schema_migrations`: para
  empezar de cero hay que borrar esa tabla y volver a correr la 000.
- Los datos de prueba se pierden (o hay que exportarlos y transformarlos).

**Recomendación:** no rehacer el esquema. Ajustar el informe a la realidad
implementada y cerrar las brechas del punto 10.1–10.4 con migraciones
aditivas, que es lo que hace el resto del proyecto.

---

## 11. Resumen en cinco líneas

1. **PostgreSQL, base `barberia`, esquema `public`, 9 tablas** en español.
2. **El flujo es:** usuario → barbero → servicios y horarios → cita → saldo.
3. **La integridad la impone la base:** 8 FKs con `CASCADE`, 4 `UNIQUE`, 4 `CHECK`.
4. **El `double-booking` se evita** con `FOR UPDATE` + consulta de solapamiento +
   reglas de calendario, todo en una transacción ACID (responde 409).
5. **El informe describe un modelo más ambicioso que el implementado**: faltan
   la tabla `RESEÑA`, las citas de invitados y el módulo real de pagos; y hay
   5 tablas implementadas que el informe no menciona.
