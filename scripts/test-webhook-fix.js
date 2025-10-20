#!/usr/bin/env node
/**
 * Script para probar la corrección del webhook
 */

import crypto from 'crypto';

const SUPABASE_URL = 'https://satzkpynnuloncwgxeev.supabase.co';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default_webhook_secret_key_2024';

// Simular el payload que envía notify-order-webhook
const payload = {
  event: "order.created",
  order_id: "test-order-123",
  data: {
    id: "test-order-123",
    customer_name: "Test Customer",
    customer_email: "test@example.com",
    total_amount: 100,
    status: "pending",
    items: [
      {
        id: "item-1",
        name: "Test Product",
        price: 100,
        quantity: 1
      }
    ]
  },
  timestamp: new Date().toISOString()
};

// Convertir a string (como lo hace notify-order-webhook)
const payloadString = JSON.stringify(payload);

// Generar firma HMAC SHA256
const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payloadString)
  .digest('hex');

console.log('\n🔧 TEST DE WEBHOOK - CORRECCIÓN DE FIRMA\n');
console.log('📝 Payload length:', payloadString.length);
console.log('🔑 Secret length:', WEBHOOK_SECRET.length);
console.log('✍️  Firma generada:', signature.substring(0, 32) + '...');

// Enviar webhook
console.log('\n📤 Enviando webhook...');

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
    console.log('\n✅ ¡WEBHOOK EXITOSO! La firma fue validada correctamente');
  } else {
    console.log('\n❌ WEBHOOK FALLÓ');
    if (response.status === 401) {
      console.log('  Error de autenticación - revisar firma');
    }
  }
})
.catch(error => {
  console.error('\n❌ Error enviando webhook:', error);
});
