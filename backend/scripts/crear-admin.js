/*
 * Crear (o recuperar) una cuenta de administrador.
 *
 * Uso:
 *   node scripts/crear-admin.js --correo=admin@barberia.com --clave=miClave123
 *
 * También se pueden dar los datos por entorno:
 *   ADMIN_CORREO=... ADMIN_CLAVE=... node scripts/crear-admin.js
 *
 * Opciones: --nombre, --apellido, --telefono.
 *
 * Por qué existe esto:
 *
 *   - La cuenta de administrador se crea desde el panel, pero para llegar al
 *     panel hace falta entrar, y para entrar hace falta una cuenta de
 *     administrador. Este script es la puerta de atrás: funciona con la
 *     base de datos directamente, sin necesitar ninguna credencial previa.
 *
 *   - Cada entorno tiene su propia base de datos (en local es PostgreSQL, en
 *     la nube es Neon). La cuenta que se crea aquí NO se copia a la otra:
 *     hay que ejecutar el script en cada una.
 *
 *   - Si la cuenta ya existe, no falla: actualiza la clave y el rol. Así el
 *     script se puede repetir cuando se olvida la contraseña.
 *
 * La clave se guarda como hash bcrypt, nunca en texto plano, igual que
 * cuando se crea un usuario desde la web.
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { opcionesPool, resumenConexion } = require('../src/config/dbConfig');

const ROLES = ['administrador', 'barbero', 'cliente'];

// Lee `--clave=valor` de los argumentos de la línea de comandos.
const argumentos = process.argv.slice(2);

const valorDe = (nombre) => {
  const prefijo = `--${nombre}=`;
  const encontrado = argumentos.find((arg) => arg.startsWith(prefijo));
  return encontrado ? encontrado.slice(prefijo.length) : undefined;
};

const correo = (valorDe('correo') || process.env.ADMIN_CORREO || '').trim();
const clave = valorDe('clave') || process.env.ADMIN_CLAVE || '';
const nombre = (valorDe('nombre') || process.env.ADMIN_NOMBRE || 'Administrador').trim();
const apellido = (valorDe('apellido') || process.env.ADMIN_APELLIDO || 'Spring').trim();
const telefono = (valorDe('telefono') || process.env.ADMIN_TELEFONO || '04124370854').trim();
const rol = (valorDe('rol') || process.env.ADMIN_ROL || 'administrador').trim();

if (!correo || !clave) {
  console.error('\n  Faltan datos. Uso:\n');
  console.error('    node scripts/crear-admin.js --correo=admin@barberia.com --clave=miClave123\n');
  console.error('  O por entorno:\n');
  console.error('    ADMIN_CORREO=... ADMIN_CLAVE=... node scripts/crear-admin.js\n');
  process.exit(1);
}

if (clave.length < 6) {
  console.error('\n  La clave debe tener al menos 6 caracteres.\n');
  process.exit(1);
}

if (!ROLES.includes(rol)) {
  console.error(`\n  El rol debe ser uno de: ${ROLES.join(', ')}\n`);
  process.exit(1);
}

const pool = new Pool(opcionesPool());

(async () => {
  console.log(`\n  Conectando a la base de datos:\n     ${resumenConexion()}\n`);

  const hash = await bcrypt.hash(clave, 10);

  const existente = await pool.query(
    'SELECT "usuarioID", rol FROM usuario WHERE LOWER(correo) = LOWER($1)',
    [correo]
  );

  let usuarioId;

  if (existente.rows.length === 0) {
    const r = await pool.query(
      `INSERT INTO usuario (nombre, apellido, correo, telefono, rol, clave)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING "usuarioID"`,
      [nombre, apellido, correo, telefono, rol, hash]
    );
    usuarioId = r.rows[0].usuarioID;
    console.log(`    ✓ Cuenta creada (id ${usuarioId})`);
  } else {
    usuarioId = existente.rows[0].usuarioID;
    // Se actualiza también el rol: una cuenta que era cliente puede
    // promoverse a administradora, y al revés.
    const r = await pool.query(
      `UPDATE usuario
       SET nombre = $1, apellido = $2, telefono = $3, rol = $4, clave = $5
       WHERE "usuarioID" = $6
       RETURNING "usuarioID"`,
      [nombre, apellido, telefono, rol, hash, usuarioId]
    );
    usuarioId = r.rows[0].usuarioID;
    console.log(`    ✓ Cuenta existente actualizada (id ${usuarioId}, rol anterior: ${existente.rows[0].rol})`);
  }

  console.log('\n  Listo. Puedes entrar con estos datos:\n');
  console.log(`    Correo:   ${correo}`);
  console.log(`    Clave:    ${clave}`);
  console.log(`    Rol:      ${rol}`);
  console.log(`    Entrada:  /login  (el panel de administración está en /admin)\n`);

  await pool.end();
})().catch(async (error) => {
  console.error('\n  ERROR al crear la cuenta:\n');
  console.error(`    ${error.message}\n`);
  await pool.end().catch(() => {});
  process.exit(1);
});
