#!/usr/bin/env node

/**
 * Script para probar notificaciones via Edge Function
 * Ejecutar con: node scripts/test-edge-notifications.js "user-id-aqui"
 */

async function testEdgeFunctionNotification(userId) {
  try {
    console.log('🚀 Probando notificación via Edge Function...');
    console.log('User ID:', userId);

    // Load environment variables from .env file
    require('dotenv').config();
    
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log('Variables de entorno encontradas:');
      console.log('EXPO_PUBLIC_SUPABASE_URL:', !!process.env.EXPO_PUBLIC_SUPABASE_URL);
      console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
      throw new Error('Variables de entorno de Supabase no configuradas en .env local');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        userId: userId,
        title: '🧪 Prueba Edge Function',
        body: 'Esta notificación viene desde la Edge Function segura!',
        data: {
          type: 'test',
          source: 'edge-function-test',
          timestamp: new Date().toISOString()
        }
      }),
    });

    console.log('📡 Respuesta del Edge Function:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del Edge Function:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('📨 Resultado:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Notificación enviada exitosamente via Edge Function!');
    } else {
      console.log('❌ Edge Function reportó error:', result.error);
    }

    return result;

  } catch (error) {
    console.error('❌ Error probando Edge Function:', error);
    return { success: false, error: error.message };
  }
}

// Función principal
async function main() {
  console.log('🔔 Prueba de Edge Function - Notificaciones Push');
  console.log('='.repeat(50));

  const userId = process.argv[2];

  if (!userId) {
    console.log('❌ Error: Debes proporcionar un user ID');
    console.log('');
    console.log('Uso:');
    console.log('  npm run test:edge-notifications "user-id-aqui"');
    console.log('');
    console.log('Ejemplos de user IDs de tu base de datos:');
    console.log('  105be4af-8691-4b51-8ecb-3bbd50b3736e');
    console.log('  48bcaa28-23f5-4b92-b7cd-cd21c746e3a2');
    console.log('');
    process.exit(1);
  }

  const result = await testEdgeFunctionNotification(userId);

  if (result.success) {
    console.log('');
    console.log('🎉 ¡ÉXITO! La Edge Function funcionó correctamente.');
    console.log('   Revisa tu dispositivo para ver si llegó la notificación.');
  } else {
    console.log('');
    console.log('❌ FALLO: La Edge Function reportó un error.');
    console.log('   Error:', result.error);
  }

  console.log('');
  console.log('='.repeat(50));
}

// Ejecutar script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEdgeFunctionNotification };