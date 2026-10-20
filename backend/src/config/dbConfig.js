require('dotenv').config();

/*
 * Configuración de conexión a PostgreSQL, compartida por la API y el runner de
 * migraciones.
 *
 * Hay dos formas de indicar la base de datos, y las dos siguen siendo válidas:
 *
 *  1. `DATABASE_URL` — una sola cadena de conexión. Es lo que entregan los
 *     proveedores gestionados (Neon, Supabase, Railway, Render Postgres):
 *
 *         postgresql://usuario:clave@host.neon.tech:5432/barberia?sslmode=require
 *
 *  2. Variables sueltas (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
 *     `DB_NAME`) — lo que se usa en local con PostgreSQL instalado.
 *
 * `DATABASE_URL` tiene prioridad cuando está definida.
 *
 * SSL: los proveedores gestionados exigen conexión cifrada. Se activa con
 * `DB_SSL=true` o automáticamente si la URL incluye `sslmode=require`. En local
 * no hace falta y no debe activarse (PostgreSQL local normalmente no tiene
 * certificado configurado).
 */

// `pg` ya sabe leer una URL de conexión si se le pasa `connectionString`.
// Se le da prioridad a ese campo, y se ignoran el resto.
const opcionesDesdeUrl = (url) => ({ connectionString: url });

const opcionesDesdeVariables = () => ({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});

const opcionesPool = () => {
  const url = process.env.DATABASE_URL;
  const opciones = url ? opcionesDesdeUrl(url) : opcionesDesdeVariables();

  // `rejectUnauthorized: false` porque los proveedores gestionados suelen
  // usar un certificado autofirmado para el host de la base de datos. El
  // canal sigue cifrado; lo que no se valida es la cadena del certificado.
  const ssl =
    process.env.DB_SSL === 'true' || (url && /sslmode=require/.test(url))
      ? { rejectUnauthorized: false }
      : undefined;

  if (ssl) opciones.ssl = ssl;

  // En los proveedores gestionados el pooler termina las conexiones
  // ociosas; sin esto se agota el número máximo de conexiones y la app
  // empieza a fallar con "too many clients already".
  if (process.env.DB_POOL_MAX) {
    opciones.max = Number(process.env.DB_POOL_MAX);
  }

  return opciones;
};

// Resumen legible de la base de datos activa, para los mensajes de error.
const resumenConexion = () => {
  if (process.env.DATABASE_URL) {
    // No se imprime la URL completa: contiene la contraseña.
    const sinClave = process.env.DATABASE_URL.replace(/\/\/[^@]*@/, '//***@');
    return `DATABASE_URL=${sinClave}`;
  }
  return [
    `DB_HOST=${process.env.DB_HOST || '(sin definir)'}`,
    `DB_PORT=${process.env.DB_PORT || '(sin definir, se usa 5432)'}`,
    `DB_NAME=${process.env.DB_NAME || '(sin definir)'}`,
    `DB_USER=${process.env.DB_USER || '(sin definir)'}`,
  ].join('\n     ');
};

module.exports = { opcionesPool, resumenConexion };
