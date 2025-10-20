#!/usr/bin/env node
/**
 * Script para probar con el secret correcto
 */

import crypto from 'crypto';

const SUPABASE_URL = 'https://satzkpynnuloncwgxeev.supabase.co';
const CORRECT_SECRET = 'Kzdr7C4eF9IS4EIgmH8LARdwWrvH4jCBMDOTM1SHofZNdDUHpiFEYH3WhRWx';

// Simular el payload exacto que envía notify-order-webhook
const payload = {
  event: "order.created",
  order_id: "test-order-with-correct-secret",
  data: {
    id: "test-order-with-correct-secret",
    customer_name: "Test Customer",
    customer_email: "test@example.com",
    total_amount: 100,
    status: "pending"
  },
  timestamp: new Date().toISOString()
};

// Convertir a string
const payloadString = JSON.stringify(payload);

// Generar firma con el SECRET CORRECTO
const signature = crypto
  .createHmac('sha256', CORRECT_SECRET)
  .update(payloadString)
  .digest('hex');

console.log('\n🧪 TEST CON SECRET CORRECTO\n');
console.log('📝 Secret usado:', CORRECT_SECRET.substring(0, 20) + '...');
console.log('📝 Payload length:', payloadString.length);
console.log('✍️  Firma generada:', signature);

// Enviar webhook
console.log('\n📤 Enviando webhook a dogcatify-order-webhook...');

fetch(`${SUPABASE_URL}/functions/v1/dogcatify-order-webhook`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-DogCatiFy-Signature': signature,
    'X-DogCatiFy-Event': 'order.created'
  },
  body: payloadString
})
.then(async response => {
  console.log('\n📥 Respuesta recibida:');
  console.log('  Status:', response.status);
  console.log('  Status Text:', response.statusText);

  const responseText = await response.text();
  console.log('  Body:', responseText);

  if (response.ok) {
    console.log('\n✅ ¡ÉXITO! El webhook funcionó con el secret correcto');
    console.log('\n💡 SOLUCIÓN: Necesitas configurar la variable WEBHOOK_SECRET en Supabase');
  } else {
    console.log('\n❌ Falló incluso con el secret correcto');
    console.log('Revisa los logs de dogcatify-order-webhook en Supabase');
  }
})
.catch(error => {
  console.error('\n❌ Error enviando webhook:', error);
});
