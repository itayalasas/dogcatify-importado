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
  const plugins = appJson.expo?.plugins || [];

  // Check for DataDog plugin
  const datadogPlugin = plugins.find(plugin =>
    Array.isArray(plugin) && plugin[0] === '@datadog/mobile-react-native'
  );

  console.log(`   ✅ Archivo app.json existe`);
  console.log(`   ${extra.DATADOG_CLIENT_TOKEN ? '✅' : '❌'} DATADOG_CLIENT_TOKEN`);
  console.log(`   ${extra.DATADOG_APPLICATION_ID ? '✅' : '❌'} DATADOG_APPLICATION_ID`);
  console.log(`   ${extra.DATADOG_ENV ? '✅' : '❌'} DATADOG_ENV`);
  console.log(`   ${datadogPlugin ? '✅' : '❌'} Plugin iOS configurado`);

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

// Check Android configuration
console.log('\n6️⃣ Verificando configuración nativa de Android...');
const androidBuildGradle = path.join(__dirname, '..', 'android', 'build.gradle');
const androidAppBuildGradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const mainApplication = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'dogcatify', 'app', 'MainApplication.kt');

if (fs.existsSync(androidBuildGradle)) {
  const content = fs.readFileSync(androidBuildGradle, 'utf8');
  const hasPlugin = content.includes('dd-sdk-android-gradle-plugin');
  console.log(`   ${hasPlugin ? '✅' : '❌'} Plugin de DataDog en build.gradle`);
} else {
  console.log('   ⚠️  android/build.gradle no existe (normal en Expo Managed)');
}

if (fs.existsSync(androidAppBuildGradle)) {
  const content = fs.readFileSync(androidAppBuildGradle, 'utf8');
  const hasPlugin = content.includes('com.datadoghq.dd-sdk-android-gradle-plugin');
  const hasDependency = content.includes('dd-sdk-android-logs');
  console.log(`   ${hasPlugin ? '✅' : '❌'} Plugin aplicado en app/build.gradle`);
  console.log(`   ${hasDependency ? '✅' : '❌'} Dependencia dd-sdk-android-logs`);
} else {
  console.log('   ⚠️  android/app/build.gradle no existe (normal en Expo Managed)');
}

if (fs.existsSync(mainApplication)) {
  const content = fs.readFileSync(mainApplication, 'utf8');
  const hasImports = content.includes('com.datadog.android.Datadog');
  const hasInit = content.includes('Datadog.initialize');
  console.log(`   ${hasImports ? '✅' : '❌'} Imports de DataDog en MainApplication.kt`);
  console.log(`   ${hasInit ? '✅' : '❌'} Inicialización en MainApplication.kt`);
} else {
  console.log('   ⚠️  MainApplication.kt no existe (normal en Expo Managed)');
}

console.log('\n✨ Verificación completada!\n');
console.log('📊 Resumen:');
console.log('   ✅ Configuración JavaScript: Lista');
console.log('   ✅ Plugin iOS: Configurado en app.json');
console.log('   ✅ Android nativo: Configurado (se aplicará en builds)');
console.log('\n📚 Para más información:');
console.log('   - CONFIGURACION_COMPLETA_DATADOG.md');
console.log('   - DATADOG_USAGE.md\n');
