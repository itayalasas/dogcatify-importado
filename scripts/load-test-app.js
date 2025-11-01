#!/usr/bin/env node

/**
 * Script de Prueba de Carga para DogCatiFy
 *
 * Simula múltiples usuarios accediendo a la aplicación para validar:
 * - Tiempos de respuesta
 * - Rendimiento de la API
 * - Capacidad de la base de datos
 * - Métricas en Datadog
 *
 * Uso:
 *   node scripts/load-test-app.js
 *   node scripts/load-test-app.js --users 50 --duration 60
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Parámetros de la prueba (pueden ser sobreescritos por argumentos CLI)
const DEFAULT_CONFIG = {
  numUsers: 20,              // Número de usuarios simultáneos
  durationSeconds: 30,       // Duración de la prueba en segundos
  actionIntervalMs: 2000,    // Intervalo entre acciones (ms)
  rampUpSeconds: 10,         // Tiempo de rampa (usuarios se agregan gradualmente)
};

// Parse argumentos CLI
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = parseInt(args[i + 1]);

    if (key === 'users') config.numUsers = value;
    if (key === 'duration') config.durationSeconds = value;
    if (key === 'interval') config.actionIntervalMs = value;
    if (key === 'rampup') config.rampUpSeconds = value;
  }

  return config;
}

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// Métricas globales
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  requestsByEndpoint: {},
  errors: [],
  activeUsers: 0,
};

// Actualizar métricas
function updateMetrics(endpoint, responseTime, success, error = null) {
  metrics.totalRequests++;

  if (success) {
    metrics.successfulRequests++;
    metrics.totalResponseTime += responseTime;
    metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);
  } else {
    metrics.failedRequests++;
    if (error) {
      metrics.errors.push({
        endpoint,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (!metrics.requestsByEndpoint[endpoint]) {
    metrics.requestsByEndpoint[endpoint] = {
      total: 0,
      success: 0,
      failed: 0,
      totalTime: 0,
    };
  }

  const endpointMetrics = metrics.requestsByEndpoint[endpoint];
  endpointMetrics.total++;
  if (success) {
    endpointMetrics.success++;
    endpointMetrics.totalTime += responseTime;
  } else {
    endpointMetrics.failed++;
  }
}

// Simular usuario
class VirtualUser {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.isActive = false;
    this.session = null;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async measureTime(fn, endpoint) {
    const start = Date.now();
    try {
      await fn();
      const responseTime = Date.now() - start;
      updateMetrics(endpoint, responseTime, true);
      return { success: true, responseTime };
    } catch (error) {
      const responseTime = Date.now() - start;
      updateMetrics(endpoint, responseTime, false, error);
      return { success: false, responseTime, error };
    }
  }

  // Acciones simuladas
  async fetchPets() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('pets')
        .select('id, name, species, breed')
        .limit(10);

      if (error) throw error;
      return data;
    }, 'GET /pets');
  }

  async fetchProducts() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('partner_products')
        .select('id, name, price, stock')
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;
      return data;
    }, 'GET /partner_products');
  }

  async fetchServices() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('partner_services')
        .select('id, name, description, price')
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;
      return data;
    }, 'GET /partner_services');
  }

  async fetchPlaces() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('places')
        .select('id, name, address, latitude, longitude')
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;
      return data;
    }, 'GET /places');
  }

  async fetchPromotions() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('promotions')
        .select('id, title, description, discount_percentage')
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;
      return data;
    }, 'GET /promotions');
  }

  async fetchOrders() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    }, 'GET /orders');
  }

  // Secuencia de acciones del usuario
  async performUserSession() {
    const actions = [
      () => this.fetchPets(),
      () => this.fetchProducts(),
      () => this.fetchServices(),
      () => this.fetchPlaces(),
      () => this.fetchPromotions(),
      () => this.fetchOrders(),
    ];

    while (this.isActive) {
      // Ejecutar acción aleatoria
      const action = actions[Math.floor(Math.random() * actions.length)];
      const result = await action();

      if (!result.success) {
        log(colors.red, `❌ Usuario ${this.id}: Error en acción`);
      }

      // Esperar antes de la siguiente acción
      await this.sleep(this.config.actionIntervalMs);
    }
  }

  async start() {
    this.isActive = true;
    metrics.activeUsers++;
    log(colors.cyan, `👤 Usuario ${this.id} iniciado`);
    await this.performUserSession();
  }

  stop() {
    this.isActive = false;
    metrics.activeUsers--;
    log(colors.yellow, `👤 Usuario ${this.id} detenido`);
  }
}

// Mostrar resumen de métricas
function printMetrics() {
  console.clear();
  log(colors.bright, '\n╔══════════════════════════════════════════════════════════╗');
  log(colors.bright, '║         📊 PRUEBA DE CARGA - MÉTRICAS EN VIVO          ║');
  log(colors.bright, '╚══════════════════════════════════════════════════════════╝\n');

  const avgResponseTime = metrics.totalRequests > 0
    ? (metrics.totalResponseTime / metrics.successfulRequests).toFixed(2)
    : 0;

  const successRate = metrics.totalRequests > 0
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
    : 0;

  log(colors.green, '🔹 RESUMEN GENERAL:');
  console.log(`   Total de requests:       ${metrics.totalRequests}`);
  console.log(`   Requests exitosos:       ${metrics.successfulRequests} (${successRate}%)`);
  console.log(`   Requests fallidos:       ${metrics.failedRequests}`);
  console.log(`   Usuarios activos:        ${metrics.activeUsers}`);
  console.log('');

  log(colors.cyan, '⏱️  TIEMPOS DE RESPUESTA:');
  console.log(`   Promedio:                ${avgResponseTime} ms`);
  console.log(`   Mínimo:                  ${metrics.minResponseTime === Infinity ? 'N/A' : metrics.minResponseTime + ' ms'}`);
  console.log(`   Máximo:                  ${metrics.maxResponseTime} ms`);
  console.log('');

  log(colors.magenta, '📈 MÉTRICAS POR ENDPOINT:');
  Object.entries(metrics.requestsByEndpoint).forEach(([endpoint, stats]) => {
    const avgTime = stats.success > 0 ? (stats.totalTime / stats.success).toFixed(2) : 0;
    console.log(`   ${endpoint}:`);
    console.log(`      Total: ${stats.total} | OK: ${stats.success} | Error: ${stats.failed} | Avg: ${avgTime}ms`);
  });
  console.log('');

  if (metrics.errors.length > 0) {
    log(colors.red, `⚠️  ERRORES RECIENTES (últimos 5):`);
    metrics.errors.slice(-5).forEach(err => {
      console.log(`   [${err.timestamp}] ${err.endpoint}: ${err.error}`);
    });
    console.log('');
  }

  log(colors.yellow, '💡 TIP: Monitorea estas métricas en Datadog en tiempo real');
  log(colors.yellow, '   Dashboard: https://us5.datadoghq.com/');
  console.log('');
}

// Ejecutar prueba de carga
async function runLoadTest() {
  const config = parseArgs();

  log(colors.bright, '\n╔══════════════════════════════════════════════════════════╗');
  log(colors.bright, '║            🚀 INICIANDO PRUEBA DE CARGA                 ║');
  log(colors.bright, '╚══════════════════════════════════════════════════════════╝\n');

  console.log('📋 Configuración:');
  console.log(`   Usuarios:                ${config.numUsers}`);
  console.log(`   Duración:                ${config.durationSeconds}s`);
  console.log(`   Intervalo entre acciones: ${config.actionIntervalMs}ms`);
  console.log(`   Tiempo de rampa:         ${config.rampUpSeconds}s`);
  console.log(`   Supabase URL:            ${SUPABASE_URL}`);
  console.log('');

  // Validar configuración
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    log(colors.red, '❌ Error: Variables de entorno no configuradas');
    log(colors.yellow, 'Asegúrate de tener un archivo .env con:');
    console.log('   EXPO_PUBLIC_SUPABASE_URL');
    console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  log(colors.green, '✅ Configuración válida. Iniciando prueba...\n');

  const users = [];
  const rampUpDelay = (config.rampUpSeconds * 1000) / config.numUsers;

  // Intervalo para actualizar métricas
  const metricsInterval = setInterval(printMetrics, 1000);

  // Iniciar usuarios gradualmente (rampa)
  for (let i = 0; i < config.numUsers; i++) {
    const user = new VirtualUser(i + 1, config);
    users.push(user);
    user.start();
    await new Promise(resolve => setTimeout(resolve, rampUpDelay));
  }

  log(colors.green, `\n✅ Todos los usuarios iniciados. Ejecutando prueba por ${config.durationSeconds}s...\n`);

  // Esperar duración de la prueba
  await new Promise(resolve => setTimeout(resolve, config.durationSeconds * 1000));

  // Detener usuarios
  log(colors.yellow, '\n⏹️  Deteniendo usuarios...\n');
  users.forEach(user => user.stop());

  // Esperar a que terminen
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Limpiar intervalo
  clearInterval(metricsInterval);

  // Mostrar resumen final
  printFinalReport(config);
}

// Reporte final
function printFinalReport(config) {
  console.clear();
  log(colors.bright, '\n╔══════════════════════════════════════════════════════════╗');
  log(colors.bright, '║         📊 REPORTE FINAL - PRUEBA DE CARGA             ║');
  log(colors.bright, '╚══════════════════════════════════════════════════════════╝\n');

  const avgResponseTime = metrics.successfulRequests > 0
    ? (metrics.totalResponseTime / metrics.successfulRequests).toFixed(2)
    : 0;

  const successRate = metrics.totalRequests > 0
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
    : 0;

  const requestsPerSecond = (metrics.totalRequests / config.durationSeconds).toFixed(2);

  log(colors.green, '📊 RESUMEN GENERAL:');
  console.log(`   Total de requests:       ${metrics.totalRequests}`);
  console.log(`   Requests exitosos:       ${metrics.successfulRequests}`);
  console.log(`   Requests fallidos:       ${metrics.failedRequests}`);
  console.log(`   Tasa de éxito:           ${successRate}%`);
  console.log(`   Requests por segundo:    ${requestsPerSecond}`);
  console.log('');

  log(colors.cyan, '⏱️  TIEMPOS DE RESPUESTA:');
  console.log(`   Promedio:                ${avgResponseTime} ms`);
  console.log(`   Mínimo:                  ${metrics.minResponseTime} ms`);
  console.log(`   Máximo:                  ${metrics.maxResponseTime} ms`);
  console.log('');

  log(colors.magenta, '📈 RENDIMIENTO POR ENDPOINT:');
  Object.entries(metrics.requestsByEndpoint)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([endpoint, stats]) => {
      const avgTime = stats.success > 0 ? (stats.totalTime / stats.success).toFixed(2) : 0;
      const successRate = (stats.success / stats.total * 100).toFixed(1);
      console.log(`\n   ${endpoint}:`);
      console.log(`      Total requests:      ${stats.total}`);
      console.log(`      Exitosos:            ${stats.success} (${successRate}%)`);
      console.log(`      Fallidos:            ${stats.failed}`);
      console.log(`      Tiempo promedio:     ${avgTime} ms`);
    });
  console.log('');

  // Evaluación del rendimiento
  log(colors.bright, '🎯 EVALUACIÓN:');

  if (successRate >= 99) {
    log(colors.green, '   ✅ EXCELENTE - La aplicación maneja la carga perfectamente');
  } else if (successRate >= 95) {
    log(colors.green, '   ✅ BUENO - Rendimiento aceptable con mínimos errores');
  } else if (successRate >= 90) {
    log(colors.yellow, '   ⚠️  ACEPTABLE - Algunos problemas de rendimiento');
  } else {
    log(colors.red, '   ❌ CRÍTICO - Problemas serios de rendimiento');
  }

  if (avgResponseTime < 200) {
    log(colors.green, '   ✅ EXCELENTE - Tiempos de respuesta muy rápidos');
  } else if (avgResponseTime < 500) {
    log(colors.green, '   ✅ BUENO - Tiempos de respuesta aceptables');
  } else if (avgResponseTime < 1000) {
    log(colors.yellow, '   ⚠️  LENTO - Considera optimizar las queries');
  } else {
    log(colors.red, '   ❌ MUY LENTO - Optimización urgente requerida');
  }
  console.log('');

  if (metrics.errors.length > 0) {
    log(colors.red, `⚠️  SE ENCONTRARON ${metrics.errors.length} ERRORES:`);
    const uniqueErrors = [...new Set(metrics.errors.map(e => e.error))];
    uniqueErrors.slice(0, 5).forEach(err => {
      console.log(`   - ${err}`);
    });
    if (uniqueErrors.length > 5) {
      console.log(`   ... y ${uniqueErrors.length - 5} más`);
    }
    console.log('');
  }

  log(colors.cyan, '📊 MONITOREO EN DATADOG:');
  console.log('   Dashboard: https://us5.datadoghq.com/');
  console.log('   Busca las métricas en:');
  console.log('   - APM > Services > com.dogcatify.app');
  console.log('   - Logs > Buscar por "load test"');
  console.log('   - Infrastructure > Metrics');
  console.log('');

  log(colors.yellow, '💡 PRÓXIMOS PASOS:');
  console.log('   1. Revisa las métricas en Datadog');
  console.log('   2. Identifica los endpoints más lentos');
  console.log('   3. Optimiza queries y agrega índices si es necesario');
  console.log('   4. Ejecuta la prueba nuevamente para validar mejoras');
  console.log('');
}

// Manejo de señales para detener la prueba
process.on('SIGINT', () => {
  log(colors.red, '\n\n⚠️  Prueba interrumpida por el usuario\n');
  process.exit(0);
});

// Ejecutar
runLoadTest().catch(error => {
  log(colors.red, '\n❌ Error ejecutando prueba de carga:', error.message);
  process.exit(1);
});
