/*
 * Runner de migraciones (línea de comandos).
 *
 * Uso:  node scripts/migrate.js          aplica las pendientes
 *       node scripts/migrate.js --status  solo muestra el estado
 *
 * El motor está en src/config/migraciones.js, que también usa la API al
 * arrancar para aplicar las migraciones automáticamente si la base de datos
 * está vacía.
 */

require('dotenv').config();

const { ejecutarMigraciones } = require('../src/config/migraciones');

const SOLO_ESTADO = process.argv.includes('--status');

(async () => {
  const resultado = await ejecutarMigraciones({ soloEstado: SOLO_ESTADO });

  if (resultado.errores.length > 0) {
    console.error('\n  Migraciones fallidas:\n');
    for (const error of resultado.errores) console.error(`    ${error}`);
    console.error('');
    process.exitCode = 1;
  }
})();
