#!/usr/bin/env node

/**
 * Script de Prueba de Carga con Usuarios Autenticados
 *
 * Simula usuarios reales que:
 * - Se autentican
 * - Navegan por la app
 * - Crean/editan datos
 * - Realizan compras
 *
 * Uso:
 *   node scripts/load-test-authenticated.js
 *   node scripts/load-test-authenticated.js --users 10 --duration 60
 *
 * IMPORTANTE: Este script crea usuarios de prueba en tu base de datos.
 *             Úsalo solo en ambientes de desarrollo/staging.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuración
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const DEFAULT_CONFIG = {
  numUsers: 5,
  durationSeconds: 30,
  actionIntervalMs: 3000,
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
  }

  return config;
}

// Colores
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

// Métricas
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  actionsByType: {},
  errors: [],
  activeUsers: 0,
  authenticatedUsers: 0,
};

function updateMetrics(action, responseTime, success, error = null) {
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
        action,
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (!metrics.actionsByType[action]) {
    metrics.actionsByType[action] = { total: 0, success: 0, failed: 0, totalTime: 0 };
  }

  const actionMetrics = metrics.actionsByType[action];
  actionMetrics.total++;
  if (success) {
    actionMetrics.success++;
    actionMetrics.totalTime += responseTime;
  } else {
    actionMetrics.failed++;
  }
}

// Usuario Virtual Autenticado
class AuthenticatedVirtualUser {
  constructor(id, config) {
    this.id = id;
    this.config = config;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.isActive = false;
    this.session = null;
    this.userId = null;
    this.email = `loadtest_user_${id}_${Date.now()}@test.com`;
    this.password = `Test123456!${id}`;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async measureTime(fn, actionName) {
    const start = Date.now();
    try {
      const result = await fn();
      const responseTime = Date.now() - start;
      updateMetrics(actionName, responseTime, true);
      return { success: true, responseTime, data: result };
    } catch (error) {
      const responseTime = Date.now() - start;
      updateMetrics(actionName, responseTime, false, error);
      return { success: false, responseTime, error };
    }
  }

  // Autenticación
  async signUp() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase.auth.signUp({
        email: this.email,
        password: this.password,
        options: {
          data: {
            display_name: `Test User ${this.id}`,
          },
        },
      });

      if (error) throw error;

      this.session = data.session;
      this.userId = data.user?.id;
      metrics.authenticatedUsers++;

      return data;
    }, 'AUTH_SIGNUP');
  }

  async signIn() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });

      if (error) throw error;

      this.session = data.session;
      this.userId = data.user?.id;

      return data;
    }, 'AUTH_SIGNIN');
  }

  // Acciones de Usuario
  async fetchMyPets() {
    if (!this.userId) return { success: false };

    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('pets')
        .select('*')
        .eq('owner_id', this.userId);

      if (error) throw error;
      return data;
    }, 'FETCH_MY_PETS');
  }

  async createPet() {
    if (!this.userId) return { success: false };

    const petNames = ['Max', 'Bella', 'Luna', 'Charlie', 'Rocky', 'Daisy'];
    const species = ['dog', 'cat'];
    const breeds = ['Labrador', 'Bulldog', 'Siamese', 'Persian'];

    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('pets')
        .insert({
          owner_id: this.userId,
          name: petNames[Math.floor(Math.random() * petNames.length)],
          species: species[Math.floor(Math.random() * species.length)],
          breed: breeds[Math.floor(Math.random() * breeds.length)],
          date_of_birth: new Date(2020, 0, 1).toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'CREATE_PET');
  }

  async fetchProducts() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('partner_products')
        .select('id, name, price, stock, partner_id')
        .eq('is_active', true)
        .limit(20);

      if (error) throw error;
      return data;
    }, 'FETCH_PRODUCTS');
  }

  async fetchServices() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('partner_services')
        .select('id, name, description, price, partner_id')
        .eq('is_active', true)
        .limit(20);

      if (error) throw error;
      return data;
    }, 'FETCH_SERVICES');
  }

  async createOrder() {
    if (!this.userId) return { success: false };

    return this.measureTime(async () => {
      // Fetch un producto random
      const { data: products } = await this.supabase
        .from('partner_products')
        .select('id, price, partner_id')
        .eq('is_active', true)
        .limit(5);

      if (!products || products.length === 0) {
        throw new Error('No products available');
      }

      const product = products[Math.floor(Math.random() * products.length)];

      const { data, error } = await this.supabase
        .from('orders')
        .insert({
          user_id: this.userId,
          partner_id: product.partner_id,
          total_amount: product.price,
          status: 'pending',
          payment_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'CREATE_ORDER');
  }

  async fetchMyOrders() {
    if (!this.userId) return { success: false };

    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    }, 'FETCH_MY_ORDERS');
  }

  async fetchPlaces() {
    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('places')
        .select('id, name, address, latitude, longitude, rating')
        .eq('is_active', true)
        .limit(20);

      if (error) throw error;
      return data;
    }, 'FETCH_PLACES');
  }

  async updateProfile() {
    if (!this.userId) return { success: false };

    return this.measureTime(async () => {
      const { data, error } = await this.supabase
        .from('profiles')
        .update({
          phone: `+598${Math.floor(90000000 + Math.random() * 10000000)}`,
        })
        .eq('id', this.userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, 'UPDATE_PROFILE');
  }

  // Sesión de usuario
  async performUserSession() {
    // Autenticarse
    const signUpResult = await this.signUp();
    if (!signUpResult.success) {
      log(colors.red, `❌ Usuario ${this.id}: Fallo en registro`);
      return;
    }

    log(colors.green, `✅ Usuario ${this.id}: Autenticado`);

    // Acciones que puede realizar
    const actions = [
      () => this.fetchMyPets(),
      () => this.createPet(),
      () => this.fetchProducts(),
      () => this.fetchServices(),
      () => this.fetchPlaces(),
      () => this.createOrder(),
      () => this.fetchMyOrders(),
      () => this.updateProfile(),
    ];

    while (this.isActive) {
      // Ejecutar acción aleatoria
      const action = actions[Math.floor(Math.random() * actions.length)];
      await action();

      // Esperar antes de la siguiente acción
      await this.sleep(this.config.actionIntervalMs);
    }
  }

  async start() {
    this.isActive = true;
    metrics.activeUsers++;
    await this.performUserSession();
  }

  stop() {
    this.isActive = false;
    metrics.activeUsers--;
  }

  async cleanup() {
    // Eliminar datos de prueba
    if (this.userId) {
      try {
        // Eliminar pets
        await this.supabase.from('pets').delete().eq('owner_id', this.userId);
        // Eliminar órdenes
        await this.supabase.from('orders').delete().eq('user_id', this.userId);
        // Nota: No podemos eliminar el usuario desde el cliente
        // Eso requiere privilegios de admin
      } catch (error) {
        // Silently fail cleanup
      }
    }
  }
}

// Mostrar métricas
function printMetrics() {
  console.clear();
  log(colors.bright, '\n╔══════════════════════════════════════════════════════════╗');
  log(colors.bright, '║    📊 PRUEBA DE CARGA AUTENTICADA - MÉTRICAS EN VIVO   ║');
  log(colors.bright, '╚══════════════════════════════════════════════════════════╝\n');

  const avgResponseTime = metrics.successfulRequests > 0
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
  console.log(`   Usuarios autenticados:   ${metrics.authenticatedUsers}`);
  console.log('');

  log(colors.cyan, '⏱️  TIEMPOS DE RESPUESTA:');
  console.log(`   Promedio:                ${avgResponseTime} ms`);
  console.log(`   Mínimo:                  ${metrics.minResponseTime === Infinity ? 'N/A' : metrics.minResponseTime + ' ms'}`);
  console.log(`   Máximo:                  ${metrics.maxResponseTime} ms`);
  console.log('');

  log(colors.magenta, '📈 MÉTRICAS POR TIPO DE ACCIÓN:');
  Object.entries(metrics.actionsByType)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([action, stats]) => {
      const avgTime = stats.success > 0 ? (stats.totalTime / stats.success).toFixed(2) : 0;
      const successRate = (stats.success / stats.total * 100).toFixed(0);
      console.log(`   ${action}: ${stats.total} (${successRate}% OK, ${avgTime}ms avg)`);
    });
  console.log('');

  if (metrics.errors.length > 0) {
    log(colors.red, `⚠️  ERRORES RECIENTES (últimos 3):`);
    metrics.errors.slice(-3).forEach(err => {
      console.log(`   [${err.action}] ${err.error}`);
    });
    console.log('');
  }
}

// Ejecutar prueba
async function runLoadTest() {
  const config = parseArgs();

  log(colors.bright, '\n╔══════════════════════════════════════════════════════════╗');
  log(colors.bright, '║       🚀 PRUEBA DE CARGA CON AUTENTICACIÓN              ║');
  log(colors.bright, '╚══════════════════════════════════════════════════════════╝\n');

  console.log('📋 Configuración:');
  console.log(`   Usuarios:                ${config.numUsers}`);
  console.log(`   Duración:                ${config.durationSeconds}s`);
  console.log(`   Intervalo entre acciones: ${config.actionIntervalMs}ms`);
  console.log('');

  log(colors.yellow, '⚠️  ADVERTENCIA: Este script crea usuarios de prueba.');
  log(colors.yellow, '   Úsalo solo en desarrollo/staging.\n');

  const users = [];
  const metricsInterval = setInterval(printMetrics, 1500);

  // Iniciar usuarios
  for (let i = 0; i < config.numUsers; i++) {
    const user = new AuthenticatedVirtualUser(i + 1, config);
    users.push(user);
    user.start();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Esperar duración
  await new Promise(resolve => setTimeout(resolve, config.durationSeconds * 1000));

  // Detener
  log(colors.yellow, '\n⏹️  Deteniendo usuarios...\n');
  users.forEach(user => user.stop());
  await new Promise(resolve => setTimeout(resolve, 2000));

  clearInterval(metricsInterval);

  // Cleanup
  log(colors.cyan, '🧹 Limpiando datos de prueba...\n');
  await Promise.all(users.map(user => user.cleanup()));

  // Reporte final
  printFinalReport(config);
}

// Reporte final
function printFinalReport(config) {
  console.clear();
  log(colors.bright, '\n╔══════════════════════════════════════════════════════════╗');
  log(colors.bright, '║      📊 REPORTE FINAL - PRUEBA AUTENTICADA              ║');
  log(colors.bright, '╚══════════════════════════════════════════════════════════╝\n');

  const avgResponseTime = metrics.successfulRequests > 0
    ? (metrics.totalResponseTime / metrics.successfulRequests).toFixed(2)
    : 0;

  const successRate = metrics.totalRequests > 0
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
    : 0;

  log(colors.green, '📊 RESUMEN:');
  console.log(`   Total de requests:       ${metrics.totalRequests}`);
  console.log(`   Exitosos:                ${metrics.successfulRequests} (${successRate}%)`);
  console.log(`   Fallidos:                ${metrics.failedRequests}`);
  console.log(`   Usuarios autenticados:   ${metrics.authenticatedUsers}`);
  console.log(`   Tiempo promedio:         ${avgResponseTime} ms`);
  console.log('');

  log(colors.magenta, '📈 ACCIONES MÁS LENTAS:');
  Object.entries(metrics.actionsByType)
    .map(([action, stats]) => ({
      action,
      avgTime: stats.success > 0 ? stats.totalTime / stats.success : 0,
    }))
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, 5)
    .forEach(({ action, avgTime }) => {
      console.log(`   ${action}: ${avgTime.toFixed(2)} ms`);
    });
  console.log('');

  log(colors.cyan, '💡 Revisa las métricas en Datadog:');
  console.log('   https://us5.datadoghq.com/\n');
}

// Ejecutar
runLoadTest().catch(error => {
  log(colors.red, '\n❌ Error:', error.message);
  process.exit(1);
});
