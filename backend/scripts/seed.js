/*
 * Seed de datos de demostración.
 *
 * Uso:  node scripts/seed.js
 *
 * Deja la base lista para ver la aplicación poblada tras un clon: un
 * administrador, un cliente de ejemplo, barberos con perfil público, servicios,
 * la relación barbero↔servicio y un horario lunes–sábado de 09:00 a 18:00.
 *
 * Es idempotente y NO borra nada: si un registro ya existe (mismo correo,
 * servicio, barbero o día), se respeta el que ya estaba. Se puede reejecutar sin
 * duplicar filas. Para volver a un estado limpio, reconstruye la base con
 * `npm run migrate` sobre una base vacía.
 *
 * Las contraseñas se guardan como hash bcrypt, igual que en la API.
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432
});

// Credenciales de demostración. Cámbialas antes de usar esto en producción.
const ADMIN = {
  nombre: 'Admin',
  apellido: 'Spring',
  correo: 'admin@springbarber.com',
  telefono: '3000000001',
  rol: 'administrador',
  clave: 'Admin123'
};

const CLIENTE = {
  nombre: 'Cliente',
  apellido: 'Demo',
  correo: 'cliente@springbarber.com',
  telefono: '3000000002',
  rol: 'cliente',
  clave: 'Cliente123'
};

// Cada barbero crea su propio usuario (rol 'barbero') y su perfil público.
const BARBEROS = [
  {
    usuario: {
      nombre: 'Carlos',
      apellido: 'Méndez',
      correo: 'carlos@springbarber.com',
      telefono: '3000000011',
      rol: 'barbero',
      clave: 'Barbero123'
    },
    perfil: {
      comision: 30.0,
      estado: true,
      descripcion: 'Especialista en cortes clásicos y degradados a máquina.',
      especialidad: 'Cortes clásicos y fade',
      instagram: '@carlos.barber'
    }
  },
  {
    usuario: {
      nombre: 'Andrés',
      apellido: 'Rojas',
      correo: 'andres@springbarber.com',
      telefono: '3000000012',
      rol: 'barbero',
      clave: 'Barbero123'
    },
    perfil: {
      comision: 28.0,
      estado: true,
      descripcion: 'Perfilado de barba, afeitado con navaja y ritual de toalla caliente.',
      especialidad: 'Barba y afeitado',
      instagram: '@andres.fades'
    }
  },
  {
    usuario: {
      nombre: 'Miguel',
      apellido: 'Torres',
      correo: 'miguel@springbarber.com',
      telefono: '3000000013',
      rol: 'barbero',
      clave: 'Barbero123'
    },
    perfil: {
      comision: 32.0,
      estado: true,
      descripcion: 'Diseño de cejas, coloración y tratamientos capilares.',
      especialidad: 'Cejas y color',
      instagram: '@miguel.color'
    }
  }
];

const SERVICIOS = [
  { nombre: 'Corte clásico', descripcion: 'Corte a tijera y máquina con acabado a navaja.', precio: 250.0, duracion_minutos: 30 },
  { nombre: 'Corte + barba', descripcion: 'Corte completo más perfilado y arreglo de barba.', precio: 400.0, duracion_minutos: 50 },
  { nombre: 'Afeitado con navaja', descripcion: 'Afeitado tradicional con toalla caliente y bálsamo.', precio: 180.0, duracion_minutos: 25 },
  { nombre: 'Diseño de cejas', descripcion: 'Perfilado y diseño de cejas.', precio: 120.0, duracion_minutos: 15 },
  { nombre: 'Tinte / coloración', descripcion: 'Aplicación de color o cobertura de canas.', precio: 500.0, duracion_minutos: 60 },
  { nombre: 'Tratamiento capilar', descripcion: 'Lavado, mascarilla hidratante y masaje.', precio: 300.0, duracion_minutos: 40 }
];

// Horario único para todos los barberos: de lunes a sábado.
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const HORA_INICIO = '09:00';
const HORA_FIN = '18:00';

// Inserta el usuario si no existe (por correo) y devuelve su usuarioID.
const upsertUsuario = async (client, usuario) => {
  const claveHasheada = await bcrypt.hash(usuario.clave, 10);
  const insertado = await client.query(
    `
      INSERT INTO usuario (nombre, apellido, correo, telefono, rol, clave)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (correo) DO NOTHING
      RETURNING "usuarioID"
    `,
    [usuario.nombre, usuario.apellido, usuario.correo, usuario.telefono, usuario.rol, claveHasheada]
  );

  if (insertado.rows.length > 0) return insertado.rows[0].usuarioID;

  const existente = await client.query('SELECT "usuarioID" FROM usuario WHERE correo = $1', [usuario.correo]);
  return existente.rows[0].usuarioID;
};

// Inserta el servicio si no existe (por nombre) y devuelve su serviciosID.
const upsertServicio = async (client, servicio) => {
  const existente = await client.query('SELECT "serviciosID" FROM servicios WHERE nombre = $1', [servicio.nombre]);
  if (existente.rows.length > 0) return existente.rows[0].serviciosID;

  const insertado = await client.query(
    `
      INSERT INTO servicios (nombre, descripcion, precio, duracion_minutos)
      VALUES ($1, $2, $3, $4)
      RETURNING "serviciosID"
    `,
    [servicio.nombre, servicio.descripcion, servicio.precio, servicio.duracion_minutos]
  );
  return insertado.rows[0].serviciosID;
};

// Inserta el perfil de barbero si no existe (por usuarioID) y devuelve su barberoID.
const upsertBarbero = async (client, usuarioID, perfil) => {
  const insertado = await client.query(
    `
      INSERT INTO barbero ("usuarioID", comision, estado, descripcion, especialidad, instagram)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT ("usuarioID") DO NOTHING
      RETURNING "barberoID"
    `,
    [usuarioID, perfil.comision, perfil.estado, perfil.descripcion, perfil.especialidad, perfil.instagram]
  );

  if (insertado.rows.length > 0) return insertado.rows[0].barberoID;

  const existente = await client.query('SELECT "barberoID" FROM barbero WHERE "usuarioID" = $1', [usuarioID]);
  return existente.rows[0].barberoID;
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let usuariosNuevos = 0;
    let serviciosNuevos = 0;
    let barberosNuevos = 0;
    let vinculosNuevos = 0;
    let horariosNuevos = 0;

    const antes = async (tabla) => Number((await client.query(`SELECT count(*) FROM ${tabla}`)).rows[0].count);

    const conteoUsuarios0 = await antes('usuario');
    const conteoServicios0 = await antes('servicios');
    const conteoBarberos0 = await antes('barbero');
    const conteoVinculos0 = await antes('barbero_servicio');
    const conteoHorarios0 = await antes('horario_laboral');

    console.log('\n  Cargando datos de demostración...\n');

    await upsertUsuario(client, ADMIN);
    await upsertUsuario(client, CLIENTE);

    // Servicios (se necesitan para vincularlos a los barberos).
    const serviciosIDs = [];
    for (const servicio of SERVICIOS) {
      serviciosIDs.push(await upsertServicio(client, servicio));
    }

    for (const { usuario, perfil } of BARBEROS) {
      const usuarioID = await upsertUsuario(client, usuario);
      const barberoID = await upsertBarbero(client, usuarioID, perfil);

      // Vincular todos los servicios al barbero.
      for (const servicioID of serviciosIDs) {
        await client.query(
          `
            INSERT INTO barbero_servicio ("barberoID", "servicioID")
            VALUES ($1, $2)
            ON CONFLICT ("barberoID", "servicioID") DO NOTHING
          `,
          [barberoID, servicioID]
        );
      }

      // Horario lunes–sábado.
      for (const dia of DIAS) {
        await client.query(
          `
            INSERT INTO horario_laboral ("barberoID", dia_semana, hora_inicio, hora_fin)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("barberoID", dia_semana) DO NOTHING
          `,
          [barberoID, dia, HORA_INICIO, HORA_FIN]
        );
      }
    }

    usuariosNuevos = (await antes('usuario')) - conteoUsuarios0;
    serviciosNuevos = (await antes('servicios')) - conteoServicios0;
    barberosNuevos = (await antes('barbero')) - conteoBarberos0;
    vinculosNuevos = (await antes('barbero_servicio')) - conteoVinculos0;
    horariosNuevos = (await antes('horario_laboral')) - conteoHorarios0;

    await client.query('COMMIT');

    console.log('  Datos de demostración listos:\n');
    console.log(`    Usuarios nuevos:            ${usuariosNuevos}`);
    console.log(`    Servicios nuevos:           ${serviciosNuevos}`);
    console.log(`    Barberos nuevos:            ${barberosNuevos}`);
    console.log(`    Servicios por barbero:      ${vinculosNuevos}`);
    console.log(`    Franjas de horario:         ${horariosNuevos}`);
    console.log('\n  Acceso de administrador:');
    console.log(`    correo:     ${ADMIN.correo}`);
    console.log(`    contraseña: ${ADMIN.clave}`);
    console.log('\n  Acceso de cliente:');
    console.log(`    correo:     ${CLIENTE.correo}`);
    console.log(`    contraseña: ${CLIENTE.clave}`);
    console.log('\n  (Si los contadores son 0, esos datos ya existían.)\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n  No se pudieron cargar los datos de demostración:\n');
    console.error(`  ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
