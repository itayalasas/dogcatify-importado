#!/usr/bin/env node
/**
 * Script de prueba para el webhook notify-order-webhook
 *
 * Este script:
 * 1. Obtiene una orden existente
 * 2. Dispara el webhook manualmente
 * 3. Muestra los datos que se enviarían
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zkgiwamycbjcogcgqhff.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZ2l3YW15Y2JqY29nY2dxaGZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4Njg1MDQsImV4cCI6MjA2MzQ0NDUwNH0.tyKCfVlMlH1sqGhVqDG8_Cz3zvqDOwGISLikHE6wnPk';

console.log('\n╔═════════════════════════════════════════════════════════╗');
console.log('║   🧪 TEST: notify-order-webhook Edge Function        ║');
console.log('╚═════════════════════════════════════════════════════════╝\n');

/**
 * Obtener una orden de prueba
 */
async function getTestOrder() {
  console.log('📋 Buscando una orden de prueba...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total_amount, customer_id')
    .limit(1);

  if (error || !orders || orders.length === 0) {
    console.log('⚠️  No hay órdenes en la base de datos.');
    console.log('💡 Creando una orden de prueba...\n');
    return await createTestOrder();
  }

  const order = orders[0];
  console.log('✅ Orden encontrada:');
  console.log(`   ID: ${order.id}`);
  console.log(`   Status: ${order.status}`);
  console.log(`   Total: $${order.total_amount}\n`);

  return order.id;
}

/**
 * Crear una orden de prueba
 */
async function createTestOrder() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Obtener un usuario
  const { data: users } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  if (!users || users.length === 0) {
    console.error('❌ No hay usuarios en la base de datos\n');
    return null;
  }

  // Obtener un partner
  const { data: partners } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_partner', true)
    .limit(1);

  if (!partners || partners.length === 0) {
    console.error('❌ No hay partners en la base de datos\n');
    return null;
  }

  const orderData = {
    partner_id: partners[0].id,
    customer_id: users[0].id,
    status: 'pending',
    order_type: 'product',
    total_amount: 150.00,
    items: [
      {
        id: 'test-product-1',
        name: 'Producto de Prueba',
        price: 150.00,
        quantity: 1,
      }
    ],
  };

  const { data: order, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error creando orden:', error.message, '\n');
    return null;
  }

  console.log('✅ Orden de prueba creada:');
  console.log(`   ID: ${order.id}\n`);

  return order.id;
}

/**
 * Disparar el webhook
 */
async function triggerWebhook(orderId, eventType = 'order.created') {
  console.log(`🚀 Disparando webhook para: ${eventType}\n`);

  const webhookUrl = `${SUPABASE_URL}/functions/v1/notify-order-webhook`;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        order_id: orderId,
        event_type: eventType,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Webhook disparado exitosamente\n');
      console.log('📊 Respuesta:');
      console.log(JSON.stringify(result, null, 2));
      console.log('');
    } else {
      console.error('❌ Error al disparar webhook:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${result.error}`);
      console.error(`   Mensaje: ${result.message}\n`);
    }
  } catch (error) {
    console.error('❌ Error de red:', error.message, '\n');
  }
}

/**
 * Ejecutar el test
 */
async function runTest() {
  // Paso 1: Obtener o crear una orden
  const orderId = await getTestOrder();

  if (!orderId) {
    console.error('❌ No se pudo obtener una orden para probar\n');
    return;
  }

  // Paso 2: Disparar el webhook
  await triggerWebhook(orderId, 'order.created');

  console.log('\n╔═════════════════════════════════════════════════════════╗');
  console.log('║              ✅ Test Completado                        ║');
  console.log('╚═════════════════════════════════════════════════════════╝\n');

  console.log('💡 Para probar manualmente en Postman/Insomnia:\n');
  console.log(`   URL: ${SUPABASE_URL}/functions/v1/notify-order-webhook`);
  console.log('   Method: POST');
  console.log('   Headers:');
  console.log('     Content-Type: application/json');
  console.log(`     Authorization: Bearer ${SUPABASE_ANON_KEY}`);
  console.log('   Body:');
  console.log('   {');
  console.log(`     "order_id": "${orderId}",`);
  console.log('     "event_type": "order.created"');
  console.log('   }\n');
}

// Ejecutar test
runTest().catch(console.error);
