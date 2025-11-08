require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar configurados en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFCMv1() {
  console.log('=== TEST FCM API v1 ===\n');

  console.log('1. Buscando usuarios con FCM token...');
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, fcm_token, push_token')
    .not('fcm_token', 'is', null)
    .limit(5);

  if (profilesError) {
    console.error('❌ Error obteniendo profiles:', profilesError);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('❌ No se encontraron usuarios con FCM token');
    console.log('\n📝 Nota: Los usuarios deben registrar sus notificaciones primero');
    console.log('   El FCM token se obtiene automáticamente en Android al registrar notificaciones');
    return;
  }

  console.log(`✅ Encontrados ${profiles.length} usuarios con FCM token:\n`);
  profiles.forEach((profile, index) => {
    console.log(`${index + 1}. ${profile.display_name || 'Sin nombre'}`);
    console.log(`   - ID: ${profile.id}`);
    console.log(`   - FCM Token: ${profile.fcm_token.substring(0, 30)}...`);
    console.log(`   - Expo Token: ${profile.push_token ? profile.push_token.substring(0, 30) + '...' : 'N/A'}`);
    console.log('');
  });

  const testProfile = profiles[0];
  console.log(`\n2. Enviando notificación de prueba a: ${testProfile.display_name || 'Usuario'}`);
  console.log(`   FCM Token: ${testProfile.fcm_token.substring(0, 40)}...\n`);

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-notification-fcm-v1`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          token: testProfile.fcm_token,
          title: '🔔 Test FCM API v1',
          body: 'Esta es una notificación de prueba enviada con Firebase Cloud Messaging API v1',
          data: {
            test: 'true',
            timestamp: new Date().toISOString(),
            method: 'fcm-v1'
          },
          sound: 'default',
          channelId: 'default'
        }),
      }
    );

    console.log('Status de respuesta:', response.status, response.statusText);

    const result = await response.json();

    if (response.ok) {
      console.log('\n✅ NOTIFICACIÓN ENVIADA EXITOSAMENTE!');
      console.log('Resultado:', JSON.stringify(result, null, 2));
      console.log('\n📱 Revisa tu dispositivo Android para ver la notificación');
    } else {
      console.log('\n❌ ERROR AL ENVIAR NOTIFICACIÓN');
      console.log('Detalles del error:', JSON.stringify(result, null, 2));

      if (result.error === 'FIREBASE_SERVICE_ACCOUNT not configured') {
        console.log('\n⚠️  ACCIÓN REQUERIDA:');
        console.log('El Service Account de Firebase no está configurado.');
        console.log('Sigue estos pasos:');
        console.log('1. Ve a Firebase Console → Project Settings → Service Accounts');
        console.log('2. Descarga el archivo JSON del Service Account');
        console.log('3. Configura el secret en Supabase:');
        console.log('   supabase secrets set FIREBASE_SERVICE_ACCOUNT=\'{"type":"service_account",...}\'');
      }
    }
  } catch (error) {
    console.error('\n❌ Error en la petición:', error.message);
  }

  console.log('\n=== FIN DEL TEST ===\n');
}

async function testServiceAccountConfig() {
  console.log('\n=== VERIFICANDO CONFIGURACIÓN ===\n');

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-notification-fcm-v1`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          token: 'test-token',
          title: 'Test',
          body: 'Test'
        }),
      }
    );

    const result = await response.json();

    if (result.error === 'FIREBASE_SERVICE_ACCOUNT not configured') {
      console.log('❌ Service Account NO configurado');
      console.log('\n📝 INSTRUCCIONES PARA CONFIGURAR:\n');
      console.log('1. Descarga el Service Account JSON de Firebase');
      console.log('   https://console.firebase.google.com/project/app-mascota-7db30/settings/serviceaccounts/adminsdk');
      console.log('');
      console.log('2. Ejecuta este comando en tu terminal:');
      console.log('   supabase secrets set FIREBASE_SERVICE_ACCOUNT=\'CONTENIDO_DEL_JSON\'');
      console.log('');
      console.log('3. El JSON debe verse así:');
      console.log('   {"type":"service_account","project_id":"app-mascota-7db30",...}');
      return false;
    } else if (result.error === 'Token is required') {
      console.log('✅ Service Account configurado correctamente');
      console.log('✅ Edge function está lista para enviar notificaciones');
      console.log('✅ Payload FCM v1 validado correctamente');
      return true;
    } else if (result.error === 'Failed to send notification' && result.details?.error?.code === 400) {
      const errorMsg = result.details.error.message;
      if (errorMsg && errorMsg.includes('not a valid FCM registration token')) {
        console.log('✅ Service Account configurado correctamente');
        console.log('✅ Edge function está lista (token de prueba inválido es esperado)');
        return true;
      }
      console.log('⚠️  Error en payload FCM:', errorMsg);
      console.log('💡 La edge function necesita ser actualizada');
      return false;
    } else {
      console.log('⚠️  Respuesta inesperada:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error verificando configuración:', error.message);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   TEST: Firebase Cloud Messaging API v1   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const isConfigured = await testServiceAccountConfig();

  if (!isConfigured) {
    console.log('\n⚠️  Configura el Service Account primero antes de continuar');
    return;
  }

  await testFCMv1();
}

main();
