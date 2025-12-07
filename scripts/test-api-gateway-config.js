#!/usr/bin/env node

const appJson = require('../app.json');

console.log('='.repeat(60));
console.log('🧪 Test de Configuración del API Gateway');
console.log('='.repeat(60));
console.log();

const apiGateway = appJson.expo?.extra?.apiGateway;

if (!apiGateway) {
  console.error('❌ ERROR: No se encontró configuración de API Gateway en app.json');
  console.error('   Ruta esperada: expo.extra.apiGateway');
  process.exit(1);
}

console.log('📋 Configuración encontrada en app.json:');
console.log('   URL:', apiGateway.url);
console.log('   API Key:', apiGateway.apiKey?.substring(0, 20) + '...');
console.log();

async function testApiGateway() {
  console.log('📡 Probando conexión al API Gateway...');
  console.log();

  const startTime = Date.now();

  try {
    const response = await fetch(apiGateway.url, {
      method: 'GET',
      headers: {
        'X-Integration-Key': apiGateway.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const duration = Date.now() - startTime;

    console.log('📨 Respuesta recibida:');
    console.log('   Status:', response.status, response.statusText);
    console.log('   Tiempo:', duration + 'ms');
    console.log();

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ERROR: El API Gateway respondió con error');
      console.error('   Status:', response.status);
      console.error('   Response:', errorText);
      process.exit(1);
    }

    const data = await response.json();

    console.log('✅ API Gateway respondió correctamente');
    console.log();
    console.log('📦 Datos recibidos:');
    console.log('   Proyecto:', data.project_name);
    console.log('   Descripción:', data.description);
    console.log('   Actualizado:', data.updated_at);
    console.log();

    if (!data.variables) {
      console.error('❌ ERROR: La respuesta no contiene el campo "variables"');
      process.exit(1);
    }

    console.log('🔧 Variables recibidas:');
    const variables = data.variables;
    const requiredVars = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
      'EXPO_ROUTER_APP_ROOT',
      'EXPO_PUBLIC_PROJECT_ID',
    ];

    let allPresent = true;
    for (const varName of requiredVars) {
      const present = !!variables[varName];
      const icon = present ? '✅' : '❌';
      console.log(`   ${icon} ${varName}: ${present ? 'Presente' : 'FALTA'}`);

      if (!present) {
        allPresent = false;
      }
    }

    console.log();
    console.log('📊 Total de variables:', Object.keys(variables).length);
    console.log();

    if (!allPresent) {
      console.error('❌ ADVERTENCIA: Faltan variables requeridas');
      console.error('   Verifica que el API Gateway retorne todas las variables necesarias');
      process.exit(1);
    }

    console.log('✅ Todas las variables requeridas están presentes');
    console.log();

    // Test de Supabase URL
    const supabaseUrl = variables.EXPO_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      console.log('🔍 Validando URL de Supabase...');
      console.log('   URL:', supabaseUrl);

      if (!supabaseUrl.startsWith('https://')) {
        console.error('   ❌ La URL debe usar HTTPS');
      } else if (!supabaseUrl.includes('supabase.co')) {
        console.warn('   ⚠️  La URL no parece ser de Supabase');
      } else {
        console.log('   ✅ URL válida');
      }
      console.log();
    }

    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log();
    console.log('📱 El APK compilado podrá cargar la configuración correctamente.');
    console.log();

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('❌ ERROR al conectar con el API Gateway');
    console.error('   Tiempo transcurrido:', duration + 'ms');
    console.error('   Error:', error.message);
    console.error();

    if (error.message.includes('fetch failed')) {
      console.error('💡 Posibles causas:');
      console.error('   - El servidor no está disponible');
      console.error('   - La URL es incorrecta');
      console.error('   - Hay problemas de red/firewall');
      console.error('   - El servidor no soporta HTTPS');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('💡 El dominio no existe o no se puede resolver');
      console.error('   Verifica la URL en app.json');
    }

    console.error();
    process.exit(1);
  }
}

// Ejecutar test
testApiGateway();
