/**
 * Script para probar la configuración de DataDog
 *
 * Uso:
 *   node scripts/test-datadog.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de DataDog...\n');

// Check .env file
console.log('1️⃣ Verificando archivo .env...');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasToken = envContent.includes('EXPO_PUBLIC_DATADOG_CLIENT_TOKEN');
  const hasAppId = envContent.includes('EXPO_PUBLIC_DATADOG_APPLICATION_ID');
  const hasEnv = envContent.includes('EXPO_PUBLIC_DATADOG_ENV');

  console.log(`   ✅ Archivo .env existe`);
  console.log(`   ${hasToken ? '✅' : '❌'} EXPO_PUBLIC_DATADOG_CLIENT_TOKEN`);
  console.log(`   ${hasAppId ? '✅' : '❌'} EXPO_PUBLIC_DATADOG_APPLICATION_ID`);
  console.log(`   ${hasEnv ? '✅' : '❌'} EXPO_PUBLIC_DATADOG_ENV`);
} else {
  console.log('   ❌ Archivo .env no existe');
}

// Check app.json
console.log('\n2️⃣ Verificando archivo app.json...');
const appJsonPath = path.join(__dirname, '..', 'app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const extra = appJson.expo?.extra || {};

  console.log(`   ✅ Archivo app.json existe`);
  console.log(`   ${extra.DATADOG_CLIENT_TOKEN ? '✅' : '❌'} DATADOG_CLIENT_TOKEN`);
  console.log(`   ${extra.DATADOG_APPLICATION_ID ? '✅' : '❌'} DATADOG_APPLICATION_ID`);
  console.log(`   ${extra.DATADOG_ENV ? '✅' : '❌'} DATADOG_ENV`);

  if (extra.DATADOG_CLIENT_TOKEN) {
    console.log(`   📝 Token: ${extra.DATADOG_CLIENT_TOKEN.substring(0, 12)}...`);
  }
} else {
  console.log('   ❌ Archivo app.json no existe');
}

// Check metro.config.js
console.log('\n3️⃣ Verificando metro.config.js...');
const metroConfigPath = path.join(__dirname, '..', 'metro.config.js');
if (fs.existsSync(metroConfigPath)) {
  const metroContent = fs.readFileSync(metroConfigPath, 'utf8');
  const hasDatadogConfig = metroContent.includes('@datadog/mobile-react-native/metro');

  console.log(`   ✅ Archivo metro.config.js existe`);
  console.log(`   ${hasDatadogConfig ? '✅' : '❌'} Configuración de DataDog`);
} else {
  console.log('   ❌ Archivo metro.config.js no existe');
}

// Check datadogLogger.ts
console.log('\n4️⃣ Verificando datadogLogger.ts...');
const loggerPath = path.join(__dirname, '..', 'utils', 'datadogLogger.ts');
if (fs.existsSync(loggerPath)) {
  const loggerContent = fs.readFileSync(loggerPath, 'utf8');
  const hasDynamicImport = loggerContent.includes('require(\'@datadog/mobile-react-native\')');
  const hasLogger = loggerContent.includes('export const logger');

  console.log(`   ✅ Archivo datadogLogger.ts existe`);
  console.log(`   ${hasDynamicImport ? '✅' : '❌'} Importación dinámica (web-safe)`);
  console.log(`   ${hasLogger ? '✅' : '❌'} Logger exportado`);
} else {
  console.log('   ❌ Archivo datadogLogger.ts no existe');
}

// Check package.json
console.log('\n5️⃣ Verificando dependencias...');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const hasDatadog = packageJson.dependencies?.['@datadog/mobile-react-native'];
  const hasNavigation = packageJson.dependencies?.['@datadog/mobile-react-native-navigation'];

  console.log(`   ${hasDatadog ? '✅' : '❌'} @datadog/mobile-react-native: ${hasDatadog || 'no instalado'}`);
  console.log(`   ${hasNavigation ? '✅' : '❌'} @datadog/mobile-react-native-navigation: ${hasNavigation || 'no instalado'}`);
} else {
  console.log('   ❌ Archivo package.json no existe');
}

console.log('\n✨ Verificación completada!\n');
console.log('📚 Para más información, consulta DATADOG_USAGE.md\n');
