// Script manual para probar notificaciones push
// Ejecutar con: node scripts/test-push-manual.js

const fetch = require('node-fetch');

// Cambia este token por el tuyo (sacado de la base de datos)
const PUSH_TOKEN = 'ExponentPushToken[pCN1J3HLtxlgChzUtBT1Xi]';

async function testPushNotification() {
  console.log('=== TESTING PUSH NOTIFICATION ===');
  console.log('Token:', PUSH_TOKEN);
  console.log('');

  try {
    const message = {
      to: PUSH_TOKEN,
      sound: 'default',
      title: '🐾 Prueba Manual DogCatiFy',
      body: '¡Esta es una notificación de prueba manual!',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      },
      priority: 'high',
      channelId: 'default',
    };

    console.log('📤 Sending notification...');
    console.log('Payload:', JSON.stringify(message, null, 2));
    console.log('');

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    console.log('📥 Response status:', response.status, response.statusText);

    const responseText = await response.text();
    console.log('📥 Response body:', responseText);

    try {
      const result = JSON.parse(responseText);
      console.log('');
      console.log('✅ Parsed result:', JSON.stringify(result, null, 2));

      if (result.data && result.data[0]) {
        const firstResult = result.data[0];
        console.log('');
        console.log('📊 First result details:');
        console.log('  - Status:', firstResult.status);
        console.log('  - ID:', firstResult.id);

        if (firstResult.status === 'error') {
          console.log('');
          console.log('❌ ERROR FOUND:');
          console.log('  - Message:', firstResult.message);
          console.log('  - Details:', JSON.stringify(firstResult.details, null, 2));
        } else {
          console.log('');
          console.log('✅ NOTIFICATION SENT SUCCESSFULLY!');
          console.log('');
          console.log('Check your device now. If you don\'t see the notification:');
          console.log('  1. Make sure the app is installed (not Expo Go)');
          console.log('  2. Check notification permissions in device settings');
          console.log('  3. Make sure the app is not in Do Not Disturb mode');
          console.log('  4. Try restarting the app');
        }
      }
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON');
    }

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('');
  console.log('=== END TEST ===');
}

// Run the test
testPushNotification();
