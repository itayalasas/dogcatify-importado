#!/usr/bin/env node

/**
 * Script de diagnóstico para problemas de carga de configuración
 *
 * Este script ayuda a identificar por qué la app se queda colgada
 * en la pantalla de "Cargando configuración..."
 */

const API_GATEWAY_URL = 'https://api.flowbridge.site/functions/v1/api-gateway/a3db1463-6c83-4eb0-bc6e-9ad7db89ea8e';
const API_KEY = 'pub_4382560178cd0284e641e30eef20da87e3abde25937764c2d52e98b77a4d3f57';

console.log('========================================');
console.log('📋 Diagnóstico de Carga de Configuración');
console.log('========================================\n');

async function testApiGateway() {
  console.log('1️⃣ Probando API Gateway...');
  console.log(`   URL: ${API_GATEWAY_URL}`);
  console.log(`   API Key: ${API_KEY.substring(0, 20)}...\n`);

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(API_GATEWAY_URL, {
      method: 'GET',
      headers: {
        'X-Integration-Key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    console.log(`   ✅ Respuesta recibida en ${elapsed}ms`);
    console.log(`   Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Error: ${errorText}\n`);
      return false;
    }

    const data = await response.json();

    console.log('   📦 Datos recibidos:');
    console.log(`      - Project: ${data.project_name}`);
    console.log(`      - Description: ${data.description}`);
    console.log(`      - Variables: ${Object.keys(data.variables || {}).length}\n`);

    if (data.variables) {
      console.log('   🔑 Variables críticas:');
      console.log(`      - EXPO_PUBLIC_SUPABASE_URL: ${data.variables.EXPO_PUBLIC_SUPABASE_URL ? '✅' : '❌'}`);
      console.log(`      - EXPO_PUBLIC_SUPABASE_ANON_KEY: ${data.variables.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌'}`);
      console.log(`      - FIREBASE_PRIVATE_KEY: ${data.variables.FIREBASE_PRIVATE_KEY ? '✅' : '❌'}`);
      console.log(`      - FIREBASE_CLIENT_EMAIL: ${data.variables.FIREBASE_CLIENT_EMAIL ? '✅' : '❌'}\n`);
    }

    return true;
  } catch (error) {
    const elapsed = Date.now() - startTime;

    if (error.name === 'AbortError') {
      console.error(`   ❌ TIMEOUT después de ${elapsed}ms`);
      console.error('   📱 En dispositivos móviles con conexión lenta, esto puede causar que la app se quede colgada\n');
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      console.error(`   📱 Tiempo transcurrido: ${elapsed}ms\n`);
    }

    return false;
  }
}

async function testMultipleTimes() {
  console.log('2️⃣ Probando múltiples veces para simular conexión móvil...\n');

  const results = [];
  const attempts = 3;

  for (let i = 1; i <= attempts; i++) {
    console.log(`   Intento ${i}/${attempts}:`);
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(API_GATEWAY_URL, {
        method: 'GET',
        headers: {
          'X-Integration-Key': API_KEY,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      results.push({ success: true, time: elapsed });
      console.log(`      ✅ Éxito en ${elapsed}ms`);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      results.push({ success: false, time: elapsed });
      console.log(`      ❌ Falló en ${elapsed}ms (${error.name})`);
    }
  }

  console.log('\n   📊 Resultados:');
  const successful = results.filter(r => r.success).length;
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

  console.log(`      - Exitosas: ${successful}/${attempts}`);
  console.log(`      - Tiempo promedio: ${Math.round(avgTime)}ms`);
  console.log(`      - Tiempo máximo: ${Math.max(...results.map(r => r.time))}ms\n`);

  if (avgTime > 5000) {
    console.warn('   ⚠️  ADVERTENCIA: El tiempo de respuesta es muy alto (>${avgTime}ms)');
    console.warn('   📱 En dispositivos móviles con datos móviles, esto puede causar timeouts\n');
  }
}

async function checkAppJson() {
  console.log('3️⃣ Verificando configuración en app.json...\n');

  try {
    const fs = require('fs');
    const path = require('path');

    const appJsonPath = path.join(process.cwd(), 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

    const apiGateway = appJson.expo?.extra?.apiGateway;

    console.log('   📄 app.json:');
    console.log(`      - apiGateway configurado: ${apiGateway ? '✅' : '❌'}`);

    if (apiGateway) {
      console.log(`      - URL: ${apiGateway.url}`);
      console.log(`      - API Key: ${apiGateway.apiKey ? '✅' : '❌'}`);
      console.log(`      - URL coincide: ${apiGateway.url === API_GATEWAY_URL ? '✅' : '❌'}\n`);
    } else {
      console.error('   ❌ NO hay configuración de API Gateway en app.json\n');
    }
  } catch (error) {
    console.error(`   ❌ Error leyendo app.json: ${error.message}\n`);
  }
}

async function main() {
  const apiGatewayOk = await testApiGateway();
  await testMultipleTimes();
  await checkAppJson();

  console.log('========================================');
  console.log('📋 DIAGNÓSTICO COMPLETO');
  console.log('========================================\n');

  if (apiGatewayOk) {
    console.log('✅ API Gateway funciona correctamente desde tu red');
    console.log('\n🔍 Posibles causas del problema en el APK:\n');
    console.log('   1. 📱 Red móvil lenta en el dispositivo');
    console.log('   2. 🕐 Timeout de 30 segundos muy corto para datos móviles');
    console.log('   3. 💾 Caché corrupta en AsyncStorage del dispositivo');
    console.log('   4. 🔥 Firewall o restricciones de red del operador');
    console.log('   5. 🐛 Errores no mostrados correctamente en la UI\n');

    console.log('💡 SOLUCIONES RECOMENDADAS:\n');
    console.log('   A. Aumentar el timeout a 60 segundos');
    console.log('   B. Agregar reintentos automáticos (3 intentos)');
    console.log('   C. Mejorar mensajes de error en la UI');
    console.log('   D. Agregar opción de "Reintentar" en pantalla de error');
    console.log('   E. Cachear las variables en el build del APK como fallback\n');
  } else {
    console.log('❌ API Gateway NO funciona desde tu red');
    console.log('\n🔍 Posibles causas:\n');
    console.log('   1. 🌐 Problemas de conectividad a internet');
    console.log('   2. 🔥 Firewall bloqueando la petición');
    console.log('   3. 🚫 API Gateway caído o no accesible\n');

    console.log('💡 SOLUCIONES:\n');
    console.log('   1. Verificar conexión a internet');
    console.log('   2. Probar desde otra red');
    console.log('   3. Configurar variables en el build del APK\n');
  }

  console.log('========================================\n');
}

main().catch(console.error);
