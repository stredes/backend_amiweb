require('dotenv').config();
require('ts-node/register');

// Obtener el script a ejecutar desde argumentos
const scriptPath = process.argv[2];
if (scriptPath) {
  require(scriptPath.startsWith('./') ? scriptPath : `./${scriptPath}`);
} else {
  // Fallback al script por defecto
  require('./init-firestore.ts');
}
