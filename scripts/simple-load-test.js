/**
 * Simple Load Test - Sin dependencias externas
 *
 * Usa este script si tienes problemas con npm install
 *
 * Uso:
 *   node scripts/simple-load-test.js
 *   node scripts/simple-load-test.js --users 10 --duration 30
 */

// Leer .env manualmente
const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    const env = {};
    lines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim();
        env[key.trim()] = value;
      }
    });

    return env;
  } catch (error) {
    console.error('\n❌ Error: No se pudo leer el archivo .env\n');
    console.log('Asegúrate de tener un archivo .env con:');
    console.log('  EXPO_PUBLIC_SUPABASE_URL=https://...');
    console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...\n');
    process.exit(1);
  }
}

const env = loadEnv();
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ Error: Variables de entorno no encontradas en .env\n');
  process.exit(1);
}

// Configuración
const args = process.argv.slice(2);
let numUsers = 5;
let durationSeconds = 15;

for (let i = 0; i < args.length; i += 2) {
  if (args[i] === '--users') numUsers = parseInt(args[i + 1]);
  if (args[i] === '--duration') durationSeconds = parseInt(args[i + 1]);
}

// Métricas
const metrics = {
  requests: 0,
  success: 0,
  failed: 0,
  totalTime: 0,
  minTime: Infinity,
  maxTime: 0,
  errors: [],
};

// Endpoints a probar
const endpoints = [
  'pets?select=id,name,species&limit=10',
  'partner_products?select=id,name,price&is_active=eq.true&limit=10',
  'partner_services?select=id,name,price&is_active=eq.true&limit=10',
  'places?select=id,name,address&is_active=eq.true&limit=10',
  'profiles?select=id,display_name&limit=10',
];

// Hacer request con fetch
async function makeRequest(endpoint) {
  const start = Date.now();
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await response.json(); // Parse la respuesta

    const duration = Date.now() - start;
    metrics.requests++;
    metrics.success++;
    metrics.totalTime += duration;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);

    return { success: true, duration, endpoint };
  } catch (error) {
    const duration = Date.now() - start;
    metrics.requests++;
    metrics.failed++;
    metrics.errors.push({
      endpoint,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    return { success: false, error: error.message, duration, endpoint };
  }
}

// Simular usuario
async function simulateUser(userId) {
  const startTime = Date.now();
  const endTime = startTime + (durationSeconds * 1000);
  let userRequests = 0;

  while (Date.now() < endTime) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    await makeRequest(endpoint);
    userRequests++;

    // Esperar entre 1-3 segundos entre requests
    const waitTime = 1000 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  return { userId, requests: userRequests };
}

// Mostrar métricas en tiempo real
function showLiveMetrics() {
  const avgTime = metrics.success > 0
    ? (metrics.totalTime / metrics.success).toFixed(2)
    : 0;
  const successRate = metrics.requests > 0
    ? ((metrics.success / metrics.requests) * 100).toFixed(2)
    : 0;
  const reqPerSec = durationSeconds > 0
    ? (metrics.requests / durationSeconds).toFixed(2)
    : 0;

  // Limpiar consola (compatible con Windows)
  console.clear();
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     📊 PRUEBA DE CARGA - EN VIVO               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  console.log('⏱️  Configuración:');
  console.log(`   Usuarios:          ${numUsers}`);
  console.log(`   Duración:          ${durationSeconds}s\n`);

  console.log('📈 Métricas en Tiempo Real:');
  console.log(`   Requests totales:  ${metrics.requests}`);
  console.log(`   Exitosos:          ${metrics.success} (${successRate}%)`);
  console.log(`   Fallidos:          ${metrics.failed}`);
  console.log(`   Requests/segundo:  ${reqPerSec}`);
  console.log(`   Tiempo promedio:   ${avgTime} ms`);
  console.log(`   Tiempo mínimo:     ${metrics.minTime === Infinity ? 'N/A' : metrics.minTime + ' ms'}`);
  console.log(`   Tiempo máximo:     ${metrics.maxTime} ms\n`);

  if (metrics.failed > 0) {
    console.log('⚠️  Últimos errores:');
    const lastErrors = metrics.errors.slice(-3);
    lastErrors.forEach(err => {
      console.log(`   - ${err.endpoint}: ${err.error}`);
    });
    console.log('');
  }
}

// Ejecutar prueba
async function runLoadTest() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     🚀 INICIANDO PRUEBA DE CARGA               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  console.log('⚙️  Configuración:');
  console.log(`   Usuarios simultáneos: ${numUsers}`);
  console.log(`   Duración:             ${durationSeconds} segundos`);
  console.log(`   Supabase URL:         ${SUPABASE_URL}`);
  console.log('\n▶️  Iniciando simulación de usuarios...\n');

  const testStart = Date.now();

  // Actualizar métricas cada segundo
  const metricsInterval = setInterval(showLiveMetrics, 1000);

  // Crear promesas de usuarios
  const userPromises = [];
  for (let i = 0; i < numUsers; i++) {
    userPromises.push(simulateUser(i + 1));
  }

  // Esperar a que todos terminen
  const results = await Promise.all(userPromises);

  // Detener actualización de métricas
  clearInterval(metricsInterval);

  const testDuration = ((Date.now() - testStart) / 1000).toFixed(2);

  // Mostrar resultados finales
  console.clear();
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     ✅ PRUEBA COMPLETADA                        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const avgTime = metrics.success > 0
    ? (metrics.totalTime / metrics.success).toFixed(2)
    : 0;
  const successRate = metrics.requests > 0
    ? ((metrics.success / metrics.requests) * 100).toFixed(2)
    : 0;
  const reqPerSecond = (metrics.requests / testDuration).toFixed(2);

  console.log('📊 Resultados Finales:\n');
  console.log('   Métricas Generales:');
  console.log(`   ├─ Duración real:        ${testDuration}s`);
  console.log(`   ├─ Total requests:       ${metrics.requests}`);
  console.log(`   ├─ Requests/segundo:     ${reqPerSecond}`);
  console.log(`   ├─ Exitosos:             ${metrics.success}`);
  console.log(`   ├─ Fallidos:             ${metrics.failed}`);
  console.log(`   └─ Tasa de éxito:        ${successRate}%\n`);

  console.log('   Performance:');
  console.log(`   ├─ Tiempo promedio:      ${avgTime} ms`);
  console.log(`   ├─ Tiempo mínimo:        ${metrics.minTime} ms`);
  console.log(`   └─ Tiempo máximo:        ${metrics.maxTime} ms\n`);

  console.log('   Por Usuario:');
  const totalUserRequests = results.reduce((sum, r) => sum + r.requests, 0);
  const avgRequestsPerUser = (totalUserRequests / numUsers).toFixed(1);
  console.log(`   ├─ Promedio por usuario: ${avgRequestsPerUser} requests`);
  console.log(`   └─ Usuarios activos:     ${numUsers}\n`);

  // Evaluación
  if (successRate >= 95 && avgTime < 500) {
    console.log('🎉 Rendimiento: EXCELENTE');
    console.log('   - Alta tasa de éxito (>95%)');
    console.log('   - Tiempos de respuesta rápidos (<500ms)\n');
  } else if (successRate >= 90 && avgTime < 1000) {
    console.log('✅ Rendimiento: BUENO');
    console.log('   - Tasa de éxito aceptable (>90%)');
    console.log('   - Tiempos de respuesta aceptables (<1s)\n');
  } else if (successRate >= 80) {
    console.log('⚠️  Rendimiento: ACEPTABLE');
    console.log('   - Hay margen de mejora');
    console.log('   - Considera optimizar queries\n');
  } else {
    console.log('❌ Rendimiento: CRÍTICO');
    console.log('   - Alta tasa de errores');
    console.log('   - Requiere atención inmediata\n');
  }

  if (metrics.failed > 0) {
    console.log('⚠️  Errores Encontrados:\n');
    const errorCounts = {};
    metrics.errors.forEach(err => {
      const key = err.error;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`   - ${error}: ${count} veces`);
    });
    console.log('');
  }

  console.log('💡 Monitorea métricas detalladas en Datadog:');
  console.log('   https://us5.datadoghq.com/\n');

  console.log('📚 Para más opciones:');
  console.log('   node scripts/simple-load-test.js --users 20 --duration 60\n');
}

// Ejecutar
runLoadTest().catch(error => {
  console.error('\n❌ Error fatal:', error.message);
  console.error(error.stack);
  process.exit(1);
});
