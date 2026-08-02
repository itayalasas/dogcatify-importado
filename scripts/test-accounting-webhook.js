/**
 * Script de prueba para el webhook del sistema contable
 *
 * Este script prueba el envío de órdenes al sistema contable
 */

const SUPABASE_URL = 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdnpqdWlvbnF2Z3hsdmh5cWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDExNzI5MywiZXhwIjoyMDc5NjkzMjkzfQ.10BnGYY1A8HKpFM59m4MOkOnZoYvSzac45cP3A2_t2c';

async function testAccountingWebhook(orderId) {
  console.log('🧪 Iniciando prueba del webhook de contabilidad');
  console.log('📦 Order ID:', orderId);

  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/send-order-to-accounting`;

    console.log('\n🚀 Enviando solicitud a:', functionUrl);

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        order_id: orderId
      })
    });

    const responseText = await response.text();
    console.log('\n📥 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    try {
      const responseJson = JSON.parse(responseText);
      console.log('Body:', JSON.stringify(responseJson, null, 2));

      if (responseJson.success) {
        console.log('\n✅ Webhook enviado exitosamente al sistema contable');
      } else {
        console.log('\n⚠️ El webhook no se envió:', responseJson.message);
      }
    } catch (e) {
      console.log('Body (raw):', responseText);
    }

    // Consultar los logs de contabilidad
    console.log('\n📋 Consultando logs de contabilidad...');
    const logsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/accounting_webhook_logs?order_id=eq.${orderId}&order=created_at.desc&limit=5`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      }
    );

    if (logsResponse.ok) {
      const logs = await logsResponse.json();
      console.log(`\n📊 Últimos ${logs.length} logs de contabilidad:`);
      logs.forEach((log, index) => {
        console.log(`\n--- Log ${index + 1} ---`);
        console.log('ID:', log.id);
        console.log('Intento:', log.attempt_number);
        console.log('Éxito:', log.success);
        console.log('Status:', log.response_status);
        console.log('Fecha:', log.created_at);
        if (log.response_body) {
          console.log('Respuesta:', log.response_body.substring(0, 200));
        }
      });
    }

  } catch (error) {
    console.error('\n❌ Error en la prueba:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar la prueba
const orderId = process.argv[2];

if (!orderId) {
  console.error('❌ Error: Debes proporcionar un order_id');
  console.log('\nUso: node test-accounting-webhook.js <order_id>');
  console.log('\nEjemplo: node test-accounting-webhook.js 123e4567-e89b-12d3-a456-426614174000');
  process.exit(1);
}

testAccountingWebhook(orderId);
