#!/usr/bin/env node

/**
 * Test directo del webhook de Mercado Pago
 * Simula una notificación real de MP
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

async function testWebhook() {
  console.log('🧪 Probando webhook de Mercado Pago\n');

  // 1. Obtener una orden pendiente real
  console.log('📋 Buscando orden pendiente...');

  const ordersResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?status=eq.pending&order=created_at.desc&limit=1`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const orders = await ordersResponse.json();
  console.log('Respuesta de órdenes:', orders);

  if (!orders || orders.length === 0 || orders.error) {
    console.log('❌ No hay órdenes pendientes o error:', orders);
    return;
  }

  const order = orders[0];
  console.log(`✅ Orden encontrada: ${order.id}`);
  console.log(`   Total: $${order.total_amount}`);
  console.log(`   Tipo: ${order.order_type}\n`);

  // 2. Simular notificación de Mercado Pago
  const mpNotification = {
    id: 123456789,
    live_mode: false,
    type: 'payment',
    date_created: new Date().toISOString(),
    application_id: 1624486229466072,
    user_id: 1876395148,
    version: 1,
    api_version: 'v1',
    action: 'payment.created',
    data: {
      id: 'test_payment_' + Date.now() // ID de pago simulado
    }
  };

  console.log('📤 Enviando notificación webhook simulada...');
  console.log('Datos:', JSON.stringify(mpNotification, null, 2));
  console.log('');

  const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mpNotification)
    });

    console.log(`📥 Respuesta del webhook: ${webhookResponse.status}`);

    const responseText = await webhookResponse.text();
    console.log('Respuesta:', responseText);
    console.log('');

    if (webhookResponse.ok) {
      console.log('✅ Webhook procesado correctamente\n');

      // 3. Verificar si la orden se actualizó
      console.log('🔍 Verificando estado de la orden...');

      const updatedOrderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const updatedOrders = await updatedOrderResponse.json();

      if (updatedOrders && updatedOrders.length > 0) {
        const updatedOrder = updatedOrders[0];
        console.log(`Estado: ${updatedOrder.status}`);
        console.log(`Payment Status: ${updatedOrder.payment_status || 'null'}`);
        console.log(`Payment ID: ${updatedOrder.payment_id || 'null'}`);

        if (updatedOrder.status === 'confirmed') {
          console.log('\n✅ ¡ÉXITO! La orden se confirmó correctamente');
        } else {
          console.log('\n⚠️  La orden no se confirmó (aún está en estado pending)');
        }
      }
    } else {
      console.log('❌ Error en el webhook');
      console.log('Detalles:', responseText);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar test
testWebhook().catch(console.error);
