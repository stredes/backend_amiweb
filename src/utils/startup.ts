/**
 * Muestra el banner de inicio del backend
 */
export function showStartupBanner() {
  const isDev = process.env.NODE_ENV !== 'production';
  const env = isDev ? 'desarrollo' : 'producción';
  
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🚀 BACKEND AMIWEB - Sistema de Logging Activo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Entorno:       ${env.toUpperCase()}`);
  console.log(`  Node:          ${process.version}`);
  console.log(`  Plataforma:    ${process.platform}`);
  console.log(`  Firebase:      ${process.env.FIREBASE_PROJECT_ID || '❌ No configurado'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n  📡 Esperando conexión del frontend...\n');
  
  if (isDev) {
    console.log('  Frontends esperados:');
    console.log('    • Vite:        http://localhost:5173');
    console.log('    • Vite (alt):  http://localhost:5174');
    console.log('    • Next.js:     http://localhost:3000');
    console.log('');
  }
}

/**
 * Mensaje que se muestra cuando el backend está listo
 */
export function showReadyMessage(port?: number) {
  const url = port ? `http://localhost:${port}` : 'configurado';
  
  console.log('  ✅ BACKEND LISTO\n');
  console.log(`  ➜  Local:      ${url}`);
  console.log(`  ➜  Health:     ${port ? `http://localhost:${port}/api/health` : '/api/health'}`);
  console.log(`  ➜  API Docs:   ${port ? `http://localhost:${port}/api` : '/api'}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  👂 Escuchando requests del frontend...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
