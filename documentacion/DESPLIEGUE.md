# Guía de despliegue en la nube

Cómo pasar la aplicación de "abre la IP de mi portátil" a **https://springbarbershop.com**,
con HTTPS, accesible desde cualquier móvil del mundo y sin depender de que tu
equipo esté encendido.

Todo lo que hay aquí está **preparado en el repositorio** (Dockerfile, `render.yaml`,
`vercel.json`, variables de entorno). Lo que falta es lo que solo tú puedes hacer:
crear las cuentas, comprar el dominio y pegar las claves. Esta guía te lleva paso a
paso, en orden.

---

## Antes de empezar: qué vas a necesitar

| Servicio | Para qué | Coste | Cuenta |
|---|---|---|---|
| **Neon** | Base de datos PostgreSQL en la nube | Gratis (plan free, sin caducidad) | GitHub o Google |
| **Render** | La API (Node/Express) | Gratis (plan free, se apaga tras 15 min sin uso) | GitHub o Google |
| **Vercel** | La web (React/Vite) | Gratis (plan hobby) | GitHub o Google |
| **Cloudflare** | El dominio y los DNS | Dominio ~10-15 €/año, DNS gratis | Correo electrónico |

> Todos dan plan gratuito, así que puedes publicar el proyecto **sin pagar nada**
> mientras pruebas. Solo el dominio cuesta dinero (y es anual).

---

## Arquitectura

Hay dos formas de montarlo. Las dos funcionan y el repositorio está preparado
para las dos.

### Opción A — Separada (recomendada)

```
Móvil ──▶ https://springbarbershop.com        (Vercel: web React, CDN global)
                  │
                  └──▶ https://api.springbarbershop.com   (Render: API Express)
                                  │
                                  └──▶ postgresql://...   (Neon: PostgreSQL)
```

- Cada pieza va donde rindió mejor: la web en la CDN de Vercel (rápida en todo el
  mundo) y la API en Render.
- Para que la web y la API se hablen, en Vercel se define `VITE_API_URL` con la
  URL de la API.

### Opción B — Un solo servicio

```
Móvil ──▶ https://springbarbershop.com        (Render: un servicio con web + API)
                  │
                  └──▶ postgresql://...   (Neon: PostgreSQL)
```

- Un único servicio: Express sirve la API **y** la web compilada desde el mismo
  dominio (ya está implementado: el `Dockerfile` compila la web y `app.js` la
  sirve).
- Menos cuentas que configurar y CORS no hace falta (mismo origen).
- Inconveniente: la web no va por CDN.

**Si no sabes cuál elegir: empieza por la A.** Es la que se parece a un proyecto
real y la que vas a explicar en una entrevista o en la entrega. Cambiar a la B
después es fácil (basta con quitar `VITE_API_URL`).

---

## Paso 1 — Base de datos en Neon

1. Entra en <https://console.neon.tech> y crea una cuenta.
2. **Create a project** → nombre `springbarber` → región la más cercana a tus
   clientes (si están en Venezuela, la de **AWS US East (Ohio)** suele ser la que
   mejor te va).
3. Neon te da un **connection string** con esta forma:

   ```
   postgresql://usuario:clave@ep-nombre-xxxx.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
   ```

   Guárdalo: es la clave de toda la base de datos. Si la pierdes, se puede
   regenerar desde el panel.

4. **No hace falta que apliques el esquema a mano.** La API comprueba al
   arrancar si la base de datos tiene las tablas y, si no, aplica las
   migraciones sola (son idempotentes, así que solo aplica lo que falta).
   Basta con que el primer despliegue tenga ya la `DATABASE_URL` correcta.

   Si prefieres hacerlo a mano, las dos formas son equivalentes:

   - **Desde el panel de Neon** (SQL Editor): ejecutar los archivos de
     `backend/migrations/` **en orden alfabético**, de `000_esquema_base.sql` a
     `006_modulo_transacciones.sql`.
   - **Desde tu equipo**:

     ```bash
     cd backend
     DATABASE_URL="postgresql://..." npm run migrate
     ```

   Y para comprobar el estado:

     ```bash
     DATABASE_URL="postgresql://..." npm run migrate:status
     ```

5. Crea un **usuario administrador** para poder entrar al panel. Las migraciones
   crean el esquema, pero no el primer usuario. Puedes hacerlo con la API:

   ```bash
   curl -X POST https://api.springbarbershop.com/api/usuarios \
     -H "Content-Type: application/json" \
     -d '{"nombre":"Administrador","apellido":"Spring","correo":"admin@springbarber.com","password":"TU_CONTRASENA","telefono":"3001234567","rol":"administrador"}'
   ```

---

## Paso 2 — La API en Render

Render lee el `render.yaml` del repositorio y crea el servicio solo.

1. Entra en <https://render.com> y crea una cuenta.
2. **New → Blueprint** → conecta el repositorio
   `https://github.com/yhonaikermedinagarcia-a11y/spring_barber_shop`.
   Render detecta el `render.yaml` y propone crear el servicio
   `springbarber-api`.
3. Render te pedirá las variables que no puede generar solo:
   - `DATABASE_URL` → pega la del paso 1.
   - `JWT_SECRET` → se genera automáticamente (o ponle uno: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
4. **Deploy**. La primera build tarda unos minutos (compila la web y la API).
   Al final verás la URL del servicio: `https://springbarber-api.onrender.com`.

### ⚠️ El plan gratuito se duerme

Render apaga el servicio tras 15 minutos sin tráfico. La primera visita posterior
tarda **~50 segundos** en despertar (la web se queda en blanco un momento).
Es normal y no es un error.

Si molesta, el plan **Starter (7 $/mes)** lo deja siempre encendido. Para un
proyecto de barbería real, merece la pena.

### Comprobación

```bash
curl https://springbarber-api.onrender.com/api/salud
# {"ok":true,"status":"sano",...}
```

Si devuelve `503` con `"status":"sin base de datos"`, la `DATABASE_URL` está mal
puesta o las migraciones no se aplicaron.

---

## Paso 3 — La web en Vercel

1. Entra en <https://vercel.com> y crea una cuenta.
2. **Add New → Project** → importa el repositorio.
3. En los ajustes del proyecto:
   - **Root Directory**: `frontend` ← **importante**, si no Vercel no encuentra
     el `package.json`.
   - **Framework Preset**: Vite (se detecta solo).
   - **Build Command**: `npm run build` (ya viene en `frontend/vercel.json`).
   - **Output Directory**: `dist`.
4. **Environment Variables** → añade:
   - `VITE_API_URL` = `https://springbarber-api.onrender.com`
   - (Cuando tengas el dominio definitivo, cámbiala por
     `https://api.springbarbershop.com`).
5. **Deploy**. Vercel te da una URL tipo `https://spring-barber-shop.vercel.app`.

### Comprobación

Abre la URL y entra en "Servicios": si aparece la lista, la web ya habla con la
API.

---

## Paso 4 — El dominio propio

1. Entra en <https://dash.cloudflare.com> y compra el dominio (Cloudflare lo
   vende **a coste**, sin margen: unos 10-15 €/año para un `.com`).
2. En Cloudflare → **DNS → Records**, añade:
   - `api` → tipo `A` → valor `76.76.21.21` (la IP de Render) — o tipo `CNAME`
     → `springbarber-api.onrender.com`. **La opción CNAME es la recomendada.**
   - `@` (el dominio raíz) → tipo `CNAME` → `cname.vercel-dns.com` (Vercel).
3. En **SSL/TLS** → modo **Full (strict)**. Con esto ya hay HTTPS y el candado
   del navegador.
4. En Vercel → **Settings → Domains** → añade `springbarbershop.com` y
   `www.springbarbershop.com`. Vercel configura los registros por su cuenta.
5. En Render → **Settings → Custom Domains** → añade `api.springbarbershop.com`.
6. Actualiza `VITE_API_URL` en Vercel a `https://api.springbarbershop.com` y
   vuelve a desplegar (Vercel redeploys solo al guardar la variable).

### Resultado

| Dirección | Qué es |
|---|---|
| `https://springbarbershop.com` | La web |
| `https://www.springbarbershop.com` | La web (redirige a la anterior) |
| `https://api.springbarbershop.com/api/...` | La API |

### ¿Y el certificado?

Cloudflare lo emite gratis y lo renueva solo. Vercel y Render también emiten
certificados propios para sus dominios, así que hay **doble protección**: si
algún día quitas Cloudflare del camino, el sitio sigue teniendo HTTPS.

---

## Paso 5 — Lista de comprobación final

- [ ] `https://springbarbershop.com` carga la web con HTTPS y candado.
- [ ] En el móvil (datos móviles, **no** la wifi de casa) la web carga y permite
      registrar y reservar.
- [ ] `https://api.springbarbershop.com/api/salud` devuelve `{"ok":true,"status":"sano"}`.
- [ ] El login del administrador funciona.
- [ ] `VITE_API_URL` en Vercel apunta al dominio definitivo, no a `onrender.com`.
- [ ] `JWT_SECRET` de Render **no** es `clave123` ni `cambiar_esto`.
- [ ] La contraseña de PostgreSQL de Neon no está en el repositorio.
- [ ] `git status` no muestra ficheros `.env` sin trackear.

---

## Problemas frecuentes

**`password authentication failed for user 'neondb_owner'`**
→ La contraseña de Neon no es la correcta. Ojo: este error NO es de SSL ni del
host, aunque lo parezca. Para distinguirlo:

```bash
# desde tu equipo, con la contraseña que crees tener
node -e "
const {Client}=require('./backend/node_modules/pg');
const c=new Client({host:'ep-xxx-pooler.region.aws.neon.tech',port:5432,user:'neondb_owner',password:'TU_PASSWORD',database:'neondb',ssl:{rejectUnauthorized:false}});
c.connect().then(()=>c.query('select 1')).then(()=>console.log('OK')).catch(e=>console.log('ERROR:',e.message)).finally(()=>c.end());
"
```

- Si dice `connection is insecure (try using sslmode=require)` → falta SSL.
  La versión nueva de la API lo activa solo con la URL de Neon; si usas el
  código antiguo, define `PGSSLMODE=require` en el panel de Render.
- Si dice `password authentication failed` → la contraseña está mal. Vuelve al
  panel de Neon → *Connection* → copia la cadena **entera** y de una vez
  (a veces se copia un password antiguo, o el de otro proyecto). Si tienes
  dudas, usa *Reset password* en Neon y pega la nueva.

**`relation "usuario" does not exist`**
→ La base de datos está vacía: faltan las migraciones. La API las aplica sola
al arrancar; si sigue apareciendo, comprueba que la `DATABASE_URL` apunta a la
base correcta (en Neon, cada rama tiene la suya) y mira el log del despliegue:
debería verse "Aplicando 7 de 7 migraciones".

Para aplicarlas a mano:

```bash
cd backend
DATABASE_URL="postgresql://..." npm run migrate
```

Y para desactivarlas al arrancar (por ejemplo, si el usuario de la base de
datos no puede crear tablas): `AUTO_MIGRATE=false`.

**La web carga pero sale "Error interno del servidor" en las secciones de datos**
→ Es el mismo problema: la API conecta con la base de datos (por eso
`/api/salud` responde), pero las tablas no existen. Con la versión actual el
mensaje es accionable:

```json
{ "ok": false, "error": "La base de datos no tiene el esquema aplicado. Ejecuta las migraciones: npm run migrate" }
```

Y `/api/salud` devuelve `503` con `"status": "sin esquema"`, que es lo que
permite que Render marque el servicio como *unhealthy* en vez de parecer sano
mientras todo falla.

La causa más común: el Start Command quedó en `npm start` (que no migra) en
lugar de `npm run start:prod`.

**Render despliega una versión antigua del código**
→ Comprueba la rama en *Settings → Build & Deploy → Branch*. Si desplegas
`main`, `main` tiene que estar al día. Y comprueba el commit en el log del
build: dice exactamente qué versión se instaló.

**La web carga pero no hay datos / "No se pudo conectar con el servidor"**
→ `VITE_API_URL` mal puesta, o la API dormida (plan gratuito). Mira la
consola del navegador: ahí sale la URL exacta a la que intenta llamar.

**"Demasiados intentos de acceso" para todos los usuarios a la vez**
→ Falta `TRUST_PROXY=1` en Render. Sin esa variable, todas las peticiones
parecen venir de la misma IP y el limitador de login (10 por 15 min) se agota
para todo el mundo. El `render.yaml` ya lo define.

**Error de CORS en la consola**
→ La web y la API están en dominios distintos y falta `CORS_ORIGIN` en Render
con el dominio de la web: `https://springbarbershop.com`.

**La web da 404 al recargar en una ruta interna** (`/reservar`, `/login`)
→ Falta la reescritura de SPA. En Vercel la resuelve `frontend/vercel.json`
(`rewrites`); en el modo de un solo servicio, la resuelve Express.

**El build de Docker falla en Render**
→ Comprueba que el **Dockerfile Path** sea `./Dockerfile` y el **Context** sea
`.` (raíz del repositorio), no `backend/`.

**La base de datos caduca**
→ El PostgreSQL de Render caduca a los 30 días; por eso se usa Neon, cuyo plan
gratis no caduca.

**Migración nueva después de desplegar**
→ Cada redeploy ejecuta `npm run migrate` antes de arrancar. Si añades una
migración nueva en `backend/migrations/`, el siguiente deploy la aplica sola.

---

## Publicar cambios a partir de ahora

```bash
git checkout main
git pull
# ... hacer cambios ...
git push origin main
```

- **Render** redeploya solo (con *Auto-Deploy* activado) y aplica las
  migraciones pendientes.
- **Vercel** redeploya solo y reconstruye la web.

### Ramas y environments (opcional)

Vercel crea un *preview deployment* por cada rama: puedes abrir
`https://spring-barber-shop-git-mi-rama.vercel.app` para probar una rama sin
tocar producción. En Render, las ramas distintas de `main` se despliegan como
servicios separados solo si lo configuras a mano.

---

## Alternativa: todo con un solo servicio

Si prefieres la opción B (web + API en el mismo servicio de Render):

1. En Render, el servicio ya usa el `Dockerfile` de la raíz, que compila la web
   y la sirve desde Express.
2. En Vercel, **no** hace falta desplegar la web: borra el proyecto de Vercel.
3. No definas `VITE_API_URL`: en producción la web usa `/api` en el mismo
   dominio, que es justo lo que sirve el `Dockerfile`.
4. En Cloudflare, apunta `@` al CNAME de Render en lugar de al de Vercel.

---

## Anexo: los ficheros que hacen posible esto

| Fichero | Para qué sirve |
|---|---|
| `Dockerfile` | Imagen con la API y la web compilada, en dos etapas |
| `.dockerignore` | Evita que `.env`, `node_modules` y el `.docx` entren en la imagen |
| `render.yaml` | Crea el servicio de Render con sus variables ya definidas |
| `frontend/vercel.json` | Build de Vercel y reescritura de SPA |
| `backend/src/config/dbConfig.js` | Conexión por `DATABASE_URL` + SSL para bases gestionadas |
| `backend/src/app.js` | `trust proxy`, CORS configurable, cierre ordenado, sonda de salud y servido de la web compilada |
| `frontend/src/api/client.js` | `/api` en producción, autodetección en desarrollo |
| `frontend/vite.config.js` | Proxy `/api` para poder probar la build en local |
