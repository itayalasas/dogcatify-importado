#!/usr/bin/env node

const https = require('https');

/**
 * Script para probar notificaciones push en Android
 *
 * Uso:
 * node scripts/test-android-notifications.js <expo-push-token>
 */

const token = process.argv[2];

if (!token) {
  console.error('❌ Error: Debes proporcionar un token de Expo Push');
  console.log('\nUso: node scripts/test-android-notifications.js ExponentPushToken[xxx...]');
  console.log('\nPuedes obtener el token desde la pantalla de perfil de la app');
  process.exit(1);
}

if (!token.startsWith('ExponentPushToken[')) {
  console.error('❌ Error: El token debe empezar con "ExponentPushToken["');
  console.log('Token recibido:', token);
  process.exit(1);
}

console.log('🚀 Enviando notificación de prueba a Android...\n');
console.log('📱 Token:', token.substring(0, 30) + '...');

const message = {
  to: token,
  sound: 'default',
  title: '🐕 Prueba Android - DogCatiFy',
  body: 'Esta es una notificación de prueba desde Android. Si ves esto, ¡funciona! 🎉',
  data: {
    type: 'test',
    platform: 'android',
    timestamp: new Date().toISOString()
  },
  priority: 'high',
  channelId: 'default',
  badge: 1,
  ttl: 3600,
};

const postData = JSON.stringify(message);

const options = {
  hostname: 'exp.host',
  port: 443,
  path: '/--/api/v2/push/send',
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  }
};

console.log('📤 Enviando solicitud a Expo Push Notification Service...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📥 Respuesta del servidor:\n');
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    console.log('\nBody:', data);

    try {
      const response = JSON.parse(data);
      console.log('\n📊 Respuesta parseada:');
      console.log(JSON.stringify(response, null, 2));

      if (response.data && response.data[0]) {
        const result = response.data[0];

        if (result.status === 'ok') {
          console.log('\n✅ ¡Notificación enviada exitosamente!');
          console.log('ID:', result.id);
          console.log('\n🔔 Revisa tu dispositivo Android para ver la notificación');
        } else if (result.status === 'error') {
          console.log('\n❌ Error al enviar notificación:');
          console.log('Mensaje:', result.message);
          console.log('Detalles:', JSON.stringify(result.details, null, 2));

          // Proporcionar ayuda específica según el error
          if (result.details && result.details.error === 'DeviceNotRegistered') {
            console.log('\n💡 Solución: El token no está registrado o ha expirado.');
            console.log('   1. Desinstala y reinstala la app');
            console.log('   2. Vuelve a habilitar las notificaciones');
            console.log('   3. Obtén un nuevo token');
          } else if (result.message && result.message.includes('credentials')) {
            console.log('\n💡 Solución: Problema con las credenciales de FCM');
            console.log('   1. Verifica que google-services.json esté correctamente configurado');
            console.log('   2. Asegúrate de que el proyecto de Firebase esté activo');
            console.log('   3. Revisa que el package name coincida');
          }
        }
      }
    } catch (e) {
      console.error('❌ Error al parsear respuesta:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error en la solicitud:', error);
});

req.write(postData);
req.end();

console.log('⏳ Esperando respuesta...\n');
