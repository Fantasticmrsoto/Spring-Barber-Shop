/*
 * Motor de migraciones.
 *
 * Las migraciones son archivos .sql en backend/migrations, numerados por
 * prefijo y aplicadas en orden ascendente. Cada una debe ser idempotente,
 * porque el runner registra cuál se aplicó y solo salta las ya registradas.
 *
 * El registro vive en la tabla `schema_migrations`, creada aquí si no existe.
 * Así el esquema de la base se puede reconstruir desde cero clonando el
 * repositorio, sin depender de que alguien recuerde qué se ejecutó a mano.
 *
 * Este módulo lo usan dos sitios:
 *   - scripts/migrate.js, desde la línea de comandos.
 *   - src/app.js, al arrancar: si la base de datos no tiene el esquema, se
 *     aplica sola. Así un despliegue nuevo funciona sin pasos manuales.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { opcionesPool } = require('./dbConfig');

const DIRECTORIO_MIGRACIONES = path.resolve(__dirname, '../../migrations');

const registrar = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre     text PRIMARY KEY,
      aplicada_en timestamp NOT NULL DEFAULT now()
    )
  `);
};

// Devuelve [{ nombre, ruta }] en orden ascendente por nombre de archivo.
const listarMigraciones = () =>
  fs
    .readdirSync(DIRECTORIO_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ nombre: f, ruta: path.join(DIRECTORIO_MIGRACIONES, f) }));

/**
 * Aplica las migraciones pendientes.
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.soloEstado]  Solo informa del estado, no aplica nada.
 * @param {boolean} [opciones.silencioso]   No imprime por consola.
 * @param {string}  [opciones.pool]         Pool a usar. Por defecto, uno nuevo.
 * @returns {Promise<{aplicadas: number, pendientes: number, total: number, errores: string[]}>}
 */
const ejecutarMigraciones = async ({ soloEstado = false, silencioso = false, pool } = {}) => {
  const propio = !pool;
  const conexion = pool || new Pool(opcionesPool());
  const log = silencioso ? () => {} : (...args) => console.log(...args);

  const resultado = { aplicadas: 0, pendientes: 0, total: 0, errores: [] };

  const client = await conexion.connect();
  try {
    await registrar(client);
    const aplicadas = new Set(
      (await client.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre)
    );
    const migraciones = listarMigraciones();
    resultado.total = migraciones.length;

    if (soloEstado) {
      log(`\n  Migraciones (${aplicadas.size} aplicadas de ${migraciones.length}):\n`);
      for (const m of migraciones) {
        log(`    ${aplicadas.has(m.nombre) ? '✓ aplicada' : '· PENDIENTE'}  ${m.nombre}`);
      }
      log('');
      return resultado;
    }

    const pendientes = migraciones.filter((m) => !aplicadas.has(m.nombre));
    resultado.pendientes = pendientes.length;

    if (pendientes.length === 0) {
      log(
        `\n  Nada que aplicar. Las ${migraciones.length} migraciones ya están en la base.\n`
      );
      return resultado;
    }

    log(`\n  Aplicando ${pendientes.length} de ${migraciones.length} migraciones:\n`);
    for (const m of pendientes) {
      const sql = fs.readFileSync(m.ruta, 'utf8');
      process.stdout.write(silencioso ? '' : `    ${m.nombre} ... `);
      try {
        // Cada archivo trae su propio BEGIN/COMMIT.
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [m.nombre]);
        resultado.aplicadas += 1;
        if (!silencioso) console.log('ok');
      } catch (error) {
        resultado.errores.push(`${m.nombre}: ${error.message}`);
        if (!silencioso) {
          console.log('FALLÓ');
          console.error(`\n  ${error.message}\n`);
        }
        break;
      }
    }

    if (!silencioso) {
      log(`\n  ${resultado.aplicadas} migración(es) aplicada(s).\n`);
    }
    return resultado;
  } finally {
    client.release();
    if (propio) await conexion.end();
  }
};

/**
 * ¿Existe el esquema en la base de datos?
 *
 * Se pregunta por una tabla del esquema base. Si la respuesta es 42P01
 * ("relation does not exist"), la base está vacía.
 */
const esquemaPresente = async (pool) => {
  try {
    await pool.query('SELECT 1 FROM servicios LIMIT 1');
    return true;
  } catch (error) {
    if (error.code === '42P01') return false;
    // Cualquier otro error (permisos, red) no es "falta el esquema": en ese
    // caso no se toca nada y se deja que la aplicación lo reporte.
    throw error;
  }
};

module.exports = {
  ejecutarMigraciones,
  esquemaPresente,
  listarMigraciones,
  DIRECTORIO_MIGRACIONES,
};
