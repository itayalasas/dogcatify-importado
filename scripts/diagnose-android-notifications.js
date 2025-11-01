#!/usr/bin/env node

/**
 * Script de Diagnóstico: Notificaciones Push Android
 *
 * Este script verifica la configuración completa de notificaciones push
 * para Android y detecta problemas comunes.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DIAGNÓSTICO DE NOTIFICACIONES PUSH ANDROID\n');
console.log('═══════════════════════════════════════════════\n');

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function warning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`);
}

function section(title) {
  console.log(`\n${colors.blue}━━━ ${title} ━━━${colors.reset}\n`);
}

let issuesFound = 0;

// 1. Verificar google-services.json
section('1. Google Services Configuration');

const googleServicesPath = path.join(__dirname, '../android/app/google-services.json');
if (fs.existsSync(googleServicesPath)) {
  success('google-services.json encontrado en android/app/');

  try {
    const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));

    if (googleServices.project_info?.project_id) {
      success(`Project ID: ${googleServices.project_info.project_id}`);
    } else {
      error('No se encontró project_id en google-services.json');
      issuesFound++;
    }

    if (googleServices.client?.[0]?.client_info?.mobilesdk_app_id) {
      success(`App ID: ${googleServices.client[0].client_info.mobilesdk_app_id}`);
    } else {
      error('No se encontró mobilesdk_app_id');
      issuesFound++;
    }

    if (googleServices.client?.[0]?.client_info?.android_client_info?.package_name) {
      const packageName = googleServices.client[0].client_info.android_client_info.package_name;
      success(`Package Name: ${packageName}`);

      if (packageName !== 'com.dogcatify.app') {
        error(`Package name incorrecto. Esperado: com.dogcatify.app, Actual: ${packageName}`);
        issuesFound++;
      }
    } else {
      error('No se encontró package_name');
      issuesFound++;
    }

  } catch (e) {
    error(`Error parseando google-services.json: ${e.message}`);
    issuesFound++;
  }
} else {
  error('google-services.json NO encontrado en android/app/');
  warning('Copia el archivo google-services.json de Firebase a android/app/');
  issuesFound++;
}

// 2. Verificar AndroidManifest.xml
section('2. Android Manifest');

const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  success('AndroidManifest.xml encontrado');

  const manifest = fs.readFileSync(manifestPath, 'utf8');

  // Verificar permisos
  if (manifest.includes('android.permission.POST_NOTIFICATIONS')) {
    success('Permiso POST_NOTIFICATIONS presente (Android 13+)');
  } else {
    error('Falta permiso POST_NOTIFICATIONS para Android 13+');
    issuesFound++;
  }

  if (manifest.includes('com.google.firebase.MESSAGING_EVENT')) {
    success('Firebase Messaging Service configurado');
  } else {
    error('Firebase Messaging Service NO configurado');
    issuesFound++;
  }

  // Verificar package name
  const packageMatch = manifest.match(/package="([^"]+)"/);
  if (packageMatch) {
    const packageName = packageMatch[1];
    success(`Package name en manifest: ${packageName}`);

    if (packageName !== 'com.dogcatify.app') {
      error(`Package name incorrecto en manifest. Esperado: com.dogcatify.app, Actual: ${packageName}`);
      issuesFound++;
    }
  }

} else {
  error('AndroidManifest.xml NO encontrado');
  issuesFound++;
}

// 3. Verificar MyFirebaseMessagingService.kt
section('3. Firebase Messaging Service');

const messagingServicePath = path.join(__dirname, '../android/app/src/main/java/com/dogcatify/app/MyFirebaseMessagingService.kt');
if (fs.existsSync(messagingServicePath)) {
  success('MyFirebaseMessagingService.kt encontrado');

  const service = fs.readFileSync(messagingServicePath, 'utf8');

  if (service.includes('class MyFirebaseMessagingService')) {
    success('Clase MyFirebaseMessagingService definida');
  } else {
    error('Clase MyFirebaseMessagingService NO encontrada');
    issuesFound++;
  }

  if (service.includes('override fun onMessageReceived')) {
    success('Método onMessageReceived implementado');
  } else {
    error('Método onMessageReceived NO implementado');
    issuesFound++;
  }

  if (service.includes('override fun onNewToken')) {
    success('Método onNewToken implementado');
  } else {
    warning('Método onNewToken NO implementado (opcional pero recomendado)');
  }

} else {
  error('MyFirebaseMessagingService.kt NO encontrado');
  warning('Este archivo es necesario para recibir notificaciones en segundo plano');
  issuesFound++;
}

// 4. Verificar build.gradle
section('4. Build Configuration');

const buildGradlePath = path.join(__dirname, '../android/app/build.gradle');
if (fs.existsSync(buildGradlePath)) {
  success('build.gradle encontrado');

  const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

  if (buildGradle.includes('com.google.gms.google-services')) {
    success('Plugin google-services aplicado');
  } else {
    error('Plugin google-services NO aplicado');
    warning('Agrega: apply plugin: "com.google.gms.google-services"');
    issuesFound++;
  }

  if (buildGradle.includes('firebase-messaging')) {
    success('Dependencia firebase-messaging incluida');
  } else {
    error('Dependencia firebase-messaging NO encontrada');
    warning('Agrega: implementation "com.google.firebase:firebase-messaging"');
    issuesFound++;
  }

  if (buildGradle.includes('firebase-bom')) {
    success('Firebase BOM incluido');
  } else {
    warning('Firebase BOM NO encontrado (recomendado)');
  }

} else {
  error('build.gradle NO encontrado');
  issuesFound++;
}

// 5. Verificar project-level build.gradle
section('5. Project Build Configuration');

const projectBuildGradlePath = path.join(__dirname, '../android/build.gradle');
if (fs.existsSync(projectBuildGradlePath)) {
  success('Project build.gradle encontrado');

  const projectBuildGradle = fs.readFileSync(projectBuildGradlePath, 'utf8');

  if (projectBuildGradle.includes('google-services')) {
    success('Classpath google-services presente');
  } else {
    error('Classpath google-services NO encontrado');
    warning('Agrega en dependencies: classpath "com.google.gms:google-services:4.3.15"');
    issuesFound++;
  }

} else {
  warning('Project build.gradle NO encontrado (podría ser normal en algunas configuraciones)');
}

// 6. Verificar app.json / Expo config
section('6. Expo Configuration');

const appJsonPath = path.join(__dirname, '../app.json');
if (fs.existsSync(appJsonPath)) {
  success('app.json encontrado');

  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

    if (appJson.expo?.android?.package) {
      success(`Package en app.json: ${appJson.expo.android.package}`);

      if (appJson.expo.android.package !== 'com.dogcatify.app') {
        error(`Package incorrecto en app.json. Esperado: com.dogcatify.app, Actual: ${appJson.expo.android.package}`);
        issuesFound++;
      }
    } else {
      warning('Package NO especificado en app.json');
    }

    if (appJson.expo?.android?.googleServicesFile) {
      success(`googleServicesFile configurado: ${appJson.expo.android.googleServicesFile}`);
    } else {
      warning('googleServicesFile NO configurado en app.json (puede ser opcional)');
    }

  } catch (e) {
    error(`Error parseando app.json: ${e.message}`);
    issuesFound++;
  }
} else {
  error('app.json NO encontrado');
  issuesFound++;
}

// Resumen final
section('RESUMEN');

if (issuesFound === 0) {
  success('¡No se encontraron problemas! La configuración parece correcta.');
  console.log('\n📱 Si aún no recibes notificaciones:');
  console.log('   1. Asegúrate de hacer un nuevo build de la app');
  console.log('   2. Verifica permisos de notificaciones en Configuración del dispositivo');
  console.log('   3. Revisa los logs de Android con: npm run android -- --mode debug');
  console.log('   4. Prueba enviar una notificación de prueba desde Firebase Console');
} else {
  error(`Se encontraron ${issuesFound} problema(s).`);
  console.log('\n🔧 Pasos sugeridos:');
  console.log('   1. Corrige los errores indicados arriba');
  console.log('   2. Sincroniza el proyecto: cd android && ./gradlew clean');
  console.log('   3. Reconstruye la app: npm run android');
  console.log('   4. Verifica permisos en el dispositivo');
}

console.log('\n═══════════════════════════════════════════════\n');
console.log('📚 Documentación útil:');
console.log('   • Firebase Setup: https://firebase.google.com/docs/android/setup');
console.log('   • Expo Notifications: https://docs.expo.dev/push-notifications/overview/');
console.log('   • FCM Setup: https://firebase.google.com/docs/cloud-messaging/android/client\n');

process.exit(issuesFound > 0 ? 1 : 0);
