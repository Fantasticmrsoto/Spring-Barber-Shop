const { Pool } = require('pg');
require('dotenv').config();

const { opcionesPool, resumenConexion } = require('./dbConfig');

const pool = new Pool(opcionesPool());

// Prueba de conexión al cargar el archivo.
//
// Si falla, el proceso termina con código 1 en lugar de seguir escuchando. Antes
// solo se imprimía el error y el servidor arrancaba igual, con lo que parecía
// funcionar ("🚀 Servidor corriendo") pero respondía 500 a todas las peticiones.
// Para quien instala esto por primera vez, eso es mucho más difícil de
// diagnosticar que un arranque que se niega a empezar.
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('\n❌ No se pudo conectar con PostgreSQL');
    console.error(`   ${err.message}`);
    console.error('\n   Revisa backend/.env:');
    console.error(`     ${resumenConexion()}`);
    if (!process.env.DB_PASSWORD && !process.env.DATABASE_URL) {
      console.error('     DB_PASSWORD=(sin definir)');
    }
    console.error('\n   ¿La base de datos existe? Créala y aplica el esquema con:');
    console.error('     npm run migrate');
    console.error('');
    process.exit(1);
  }
  console.log(`✅ Conexión exitosa a PostgreSQL (Base de datos: ${process.env.DB_NAME || 'DATABASE_URL'})`);
});

// Ejecuta `fn` dentro de una transacción: si lanza, se hace ROLLBACK y se libera el cliente.
// Útil para lecturas + validaciones + escritura que deben ser atómicas (ej. evitar double-booking).
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  withTransaction,
};