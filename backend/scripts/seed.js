/*
 * Datos iniciales de la peluquería.
 *
 * Uso:  node scripts/seed.js
 *
 * Deja la base con el catálogo de servicios, un administrador, un barbero y
 * un cliente de ejemplo. Es idempotente: no duplica nada, se puede repetir
 * las veces que haga falta.
 *
 * Las contraseñas se pueden indicar por variables de entorno para no dejar las
 * de ejemplo en un entorno real:
 *
 *   SEED_ADMIN_PASSWORD=... SEED_BARBERO_PASSWORD=... SEED_CLIENTE_PASSWORD=...
 *
 * Si no se definen, se usan las de ejemplo, que solo valen para desarrollo.
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { opcionesPool } = require('../src/config/dbConfig');

const SERVICIOS = [
  {
    nombre: 'Corte clásico',
    descripcion: 'Corte de pelo a tijera y máquina, con lavado.',
    precio: 25000,
    duracion_minutos: 30,
  },
  {
    nombre: 'Fade premium',
    descripcion: 'Degradado a máquina con perfilado a navaja.',
    precio: 32000,
    duracion_minutos: 45,
  },
  {
    nombre: 'Arreglo de barba',
    descripcion: 'Perfilado y afeitado con toalla caliente.',
    precio: 18000,
    duracion_minutos: 20,
  },
];

const USUARIOS = [
  {
    nombre: 'Administrador',
    apellido: 'Spring',
    correo: 'admin@springbarber.com',
    telefono: '04124370853',
    rol: 'administrador',
    clave: process.env.SEED_ADMIN_PASSWORD || 'springbarber2026',
  },
  {
    nombre: 'Carlos',
    apellido: 'Navas',
    correo: 'barbero@springbarber.com',
    telefono: '3007778899',
    rol: 'barbero',
    clave: process.env.SEED_BARBERO_PASSWORD || 'springbarber2026',
  },
  {
    nombre: 'Cliente',
    apellido: 'Ejemplo',
    correo: 'cliente@springbarber.com',
    telefono: '3001234567',
    rol: 'cliente',
    clave: process.env.SEED_CLIENTE_PASSWORD || 'springbarber2026',
  },
];

const pool = new Pool(opcionesPool());

const servicioExiste = async (nombre) => {
  const r = await pool.query('SELECT 1 FROM servicios WHERE LOWER(nombre) = LOWER($1)', [nombre]);
  return r.rowCount > 0;
};

const usuarioExiste = async (correo) => {
  const r = await pool.query('SELECT "usuarioID" FROM usuario WHERE LOWER(correo) = LOWER($1)', [correo]);
  return r.rows[0]?.usuarioID ?? null;
};

const barberoExiste = async (usuarioId) => {
  const r = await pool.query('SELECT 1 FROM barbero WHERE "usuarioID" = $1', [usuarioId]);
  return r.rowCount > 0;
};

(async () => {
  console.log('\n  Sembrando datos iniciales:\n');

  for (const s of SERVICIOS) {
    if (await servicioExiste(s.nombre)) {
      console.log(`    · ${s.nombre} (ya existía)`);
      continue;
    }
    await pool.query(
      `INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos)
       VALUES ($1, $2, $3, $4)`,
      [s.nombre, s.descripcion, s.precio, s.duracion_minutos]
    );
    console.log(`    ✓ ${s.nombre}`);
  }

  const idsUsuarios = {};

  for (const u of USUARIOS) {
    const existente = await usuarioExiste(u.correo);
    if (existente) {
      idsUsuarios[u.rol] = existente;
      console.log(`    · ${u.correo} (ya existía)`);
      continue;
    }
    const hash = await bcrypt.hash(u.clave, 10);
    const r = await pool.query(
      `INSERT INTO usuario (nombre, apellido, correo, telefono, rol, clave)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING "usuarioID"`,
      [u.nombre, u.apellido, u.correo, u.telefono, u.rol, hash]
    );
    idsUsuarios[u.rol] = r.rows[0].usuarioID;
    console.log(`    ✓ ${u.correo}`);
  }

  // El barbero es un usuario con rol 'barbero' más su ficha en `barbero`.
  const usuarioBarbero = idsUsuarios.barbero;
  if (usuarioBarbero && !(await barberoExiste(usuarioBarbero))) {
    await pool.query(
      `INSERT INTO barbero ("usuarioID", comision, estado) VALUES ($1, $2, $3)`,
      [usuarioBarbero, 30, true]
    );
    console.log('    ✓ ficha de barbero');
  }

  console.log('\n  Listo. Credenciales de ejemplo:\n');
  for (const u of USUARIOS) {
    console.log(`    ${u.rol.padEnd(14)} ${u.correo.padEnd(26)} ${u.clave}`);
  }
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log('\n  ⚠️  Son las contraseñas de ejemplo. En un entorno real, define');
    console.log('      SEED_ADMIN_PASSWORD / SEED_BARBERO_PASSWORD / SEED_CLIENTE_PASSWORD');
    console.log('      y cambia las de los usuarios que ya existen a mano.\n');
  }

  await pool.end();
})();
