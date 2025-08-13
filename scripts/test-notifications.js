#!/usr/bin/env node

/**
 * Script para probar notificaciones push en desarrollo
 * Ejecutar con: node scripts/test-notifications.js "ExponentPushToken[...]"
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Función para enviar notificación de prueba
async function sendTestNotification(pushToken, title = 'Prueba DogCatiFy', body = 'Esta es una notificación de prueba') {
  try {
    console.log('🚀 Enviando notificación de prueba...');
    console.log('Token:', pushToken.substring(0, 30) + '...');
    console.log('Título:', title);
    console.log('Mensaje:', body);

    const message = {
      to: pushToken,
      title: title,
      body: body,
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        source: 'test-script'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      badge: 1,
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    console.log('📡 Respuesta del servidor:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error HTTP:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log('📨 Resultado:', JSON.stringify(result, null, 2));

    // Verificar errores en la respuesta
    if (result.data && Array.isArray(result.data)) {
      const firstResult = result.data[0];
      if (firstResult && firstResult.status === 'error') {
        console.error('❌ Error en el resultado:', firstResult);
        return { success: false, error: firstResult.message || firstResult.details };
      }
    }

    console.log('✅ Notificación enviada exitosamente!');
    return { success: true, result };

  } catch (error) {
    console.error('❌ Error enviando notificación:', error);
    return { success: false, error: error.message };
  }
}

// Función para validar formato de token
function validatePushToken(token) {
  if (!token) {
    return { valid: false, error: 'Token vacío' };
  }

  if (!token.startsWith('ExponentPushToken[')) {
    return { valid: false, error: 'Formato de token inválido - debe empezar con ExponentPushToken[' };
  }

  if (!token.endsWith(']')) {
    return { valid: false, error: 'Formato de token inválido - debe terminar con ]' };
  }

  return { valid: true };
}

// Función principal
async function main() {
  console.log('🔔 Script de Prueba de Notificaciones Push - DogCatiFy');
  console.log('================================================');

  // Obtener token desde argumentos de línea de comandos
  const pushToken = process.argv[2];

  if (!pushToken) {
    console.log('❌ Error: Debes proporcionar un push token');
    console.log('');
    console.log('Uso:');
    console.log('  npm run test:notifications "ExponentPushToken[tu-token-aqui]"');
    console.log('');
    console.log('Para obtener tu token:');
    console.log('  1. Abre la app en un dispositivo físico (build nativa)');
    console.log('  2. Ve al perfil y busca el componente de debug');
    console.log('  3. Copia el token que aparece ahí');
    console.log('');
    process.exit(1);
  }

  // Validar formato del token
  const validation = validatePushToken(pushToken);
  if (!validation.valid) {
    console.log('❌ Token inválido:', validation.error);
    process.exit(1);
  }

  console.log('✅ Token válido, enviando notificación...');
  console.log('');

  // Enviar notificación de prueba
  const result = await sendTestNotification(
    pushToken,
    '🐾 Prueba DogCatiFy',
    'Si ves esta notificación, ¡las push notifications están funcionando!'
  );

  if (result.success) {
    console.log('');
    console.log('🎉 ¡ÉXITO! La notificación se envió correctamente.');
    console.log('   Revisa tu dispositivo para ver si llegó la notificación.');
  } else {
    console.log('');
    console.log('❌ FALLO: No se pudo enviar la notificación.');
    console.log('   Error:', result.error);
  }

  console.log('');
  console.log('================================================');
}

// Ejecutar script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { sendTestNotification, validatePushToken };