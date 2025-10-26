#!/usr/bin/env node

/**
 * Simula un pago completo de Mercado Pago
 * Esto imita lo que MP enviaría cuando un pago es aprobado
 */

const SUPABASE_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZ2l3YW15Y2JqY29nY2dxaGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMDI2MTIsImV4cCI6MjA2Nzc3ODYxMn0.D-LyMJVBu0vR_iRInOKUkNLQMs5qwj_vUVZsW_JNGWE';

async function simulatePayment() {
  console.log('\n💳 Simulando pago completo de Mercado Pago\n');

  // 1. Obtener orden pendiente
  console.log('1️⃣ Buscando orden pendiente...');

  const ordersResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?status=eq.pending&order=created_at.desc&limit=1&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const orders = await ordersResponse.json();

  if (!orders || orders.length === 0) {
    console.log('❌ No hay órdenes pendientes');
    return;
  }

  const order = orders[0];
  console.log(`✅ Orden: ${order.id}`);
  console.log(`   Total: $${order.total_amount}`);
  console.log(`   Preference ID: ${order.payment_preference_id}\n`);

  // 2. Crear datos del pago simulado (como los enviaría MP)
  const paymentId = Date.now(); // Simular un payment ID
  const paymentData = {
    id: paymentId,
    status: 'approved',
    status_detail: 'accredited',
    transaction_amount: parseFloat(order.total_amount),
    currency_id: 'UYU',
    date_created: new Date().toISOString(),
    date_approved: new Date().toISOString(),
    external_reference: order.id,
    payment_method_id: 'master',
    payment_type_id: 'credit_card',
    payer: {
      email: order.customer_email,
      identification: {
        type: 'CI',
        number: '12345678'
      }
    }
  };

  console.log('2️⃣ Datos del pago simulado:');
  console.log(`   Payment ID: ${paymentId}`);
  console.log(`   Status: approved`);
  console.log(`   Amount: $${paymentData.transaction_amount}\n`);

  // 3. Enviar notificación al webhook (como lo hace MP)
  console.log('3️⃣ Enviando notificación webhook...');

  const webhookNotification = {
    id: Date.now(),
    live_mode: false,
    type: 'payment',
    date_created: new Date().toISOString(),
    application_id: 1624486229466072,
    user_id: 1876395148,
    version: 1,
    api_version: 'v1',
    action: 'payment.created',
    data: {
      id: String(paymentId)
    }
  };

  const webhookResponse = await fetch(`${SUPABASE_URL}/functions/v1/mercadopago-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(webhookNotification)
  });

  console.log(`   Respuesta: ${webhookResponse.status}`);

  if (!webhookResponse.ok) {
    const errorText = await webhookResponse.text();
    console.log(`   ❌ Error: ${errorText}\n`);
  } else {
    console.log('   ✅ Webhook recibido correctamente\n');
  }

  // 4. Esperar un momento y verificar el estado
  console.log('4️⃣ Esperando procesamiento...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const updatedOrders = await checkResponse.json();

  if (updatedOrders && updatedOrders.length > 0) {
    const updatedOrder = updatedOrders[0];
    console.log('\n📊 RESULTADO:');
    console.log(`   Estado: ${updatedOrder.status}`);
    console.log(`   Payment Status: ${updatedOrder.payment_status || 'null'}`);
    console.log(`   Payment ID: ${updatedOrder.payment_id || 'null'}`);

    if (updatedOrder.status === 'confirmed' || updatedOrder.status === 'confirmed') {
      console.log('\n🎉 ¡ÉXITO! El pago fue procesado correctamente');
      console.log(`   Comisión: $${updatedOrder.commission_amount}`);
      console.log(`   Monto Partner: $${updatedOrder.partner_amount}`);
    } else if (updatedOrder.status === 'pending') {
      console.log('\n⚠️  PROBLEMA: La orden sigue en estado pending');
      console.log('   El webhook no actualizó la orden');
      console.log('\n💡 Posibles causas:');
      console.log('   - El webhook no pudo consultar la API de Mercado Pago');
      console.log('   - Las credenciales de MP no son válidas');
      console.log('   - Error en la lógica del webhook');
    }
  }
}

// Ejecutar simulación
simulatePayment().catch(console.error);
