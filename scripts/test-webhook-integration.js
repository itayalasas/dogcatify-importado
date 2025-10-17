/**
 * Script de Prueba: Integración Completa de Webhooks
 *
 * Este script simula el flujo completo:
 * 1. Consulta órdenes existentes
 * 2. Dispara webhooks manualmente
 * 3. Verifica que lleguen al servidor local
 *
 * Requisitos:
 * - Servidor webhook corriendo (node scripts/webhook-server-example.js)
 * - Webhook registrado en la base de datos
 *
 * Uso:
 *   node scripts/test-webhook-integration.js
 */

const SUPABASE_URL = 'https://zkgiwamycbjcogcgqhff.supabase.co';
const ADMIN_TOKEN = 'dogcatify_admin_2025_secure';

async function consultarOrdenes() {
  console.log('\n1️⃣  Consultando órdenes existentes...');

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/orders-api?limit=5`,
    {
      headers: { 'X-API-Key': ADMIN_TOKEN }
    }
  );

  if (!response.ok) {
    throw new Error(`Error consultando órdenes: ${response.statusText}`);
  }

  const data = await response.json();
  const ordenes = data.data.orders;

  console.log(`   ✅ Encontradas ${ordenes.length} órdenes`);

  if (ordenes.length === 0) {
    console.log('\n   ⚠️  No hay órdenes en la base de datos');
    console.log('   💡 Crea una orden primero desde la app\n');
    return [];
  }

  ordenes.forEach((orden, index) => {
    console.log(`   ${index + 1}. ${orden.id} - Status: ${orden.status} - Total: $${orden.total_amount}`);
  });

  return ordenes;
}

async function dispararWebhook(orderId, eventType) {
  console.log(`\n2️⃣  Disparando webhook para orden ${orderId}...`);
  console.log(`   Evento: ${eventType}`);

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/notify-order-webhook`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: orderId,
        event_type: eventType
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error disparando webhook: ${error}`);
  }

  const result = await response.json();
  console.log(`   ✅ Webhook disparado exitosamente`);
  console.log(`   📤 Webhooks notificados: ${result.webhooks_notified}`);

  return result;
}

async function verificarLogs(orderId) {
  console.log('\n3️⃣  Esperando 2 segundos para que se procese...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n4️⃣  Verificar los logs:');
  console.log('   📊 En Supabase SQL Editor, ejecuta:');
  console.log(`
   SELECT
     wl.created_at,
     wl.event_type,
     wl.success,
     wl.response_status,
     ws.webhook_url
   FROM webhook_logs wl
   JOIN webhook_subscriptions ws ON ws.id = wl.webhook_subscription_id
   WHERE wl.order_id = '${orderId}'
   ORDER BY wl.created_at DESC
   LIMIT 5;
  `);

  console.log('\n   🖥️  En tu servidor webhook deberías ver:');
  console.log('   - Webhook recibido');
  console.log('   - Firma verificada');
  console.log('   - Evento procesado');
}

async function menuInteractivo() {
  const ordenes = await consultarOrdenes();

  if (ordenes.length === 0) {
    return;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Selecciona una orden para probar:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Para simplificar, tomamos la primera orden
  const ordenSeleccionada = ordenes[0];
  console.log(`✨ Orden seleccionada: ${ordenSeleccionada.id}\n`);

  console.log('Eventos disponibles:');
  console.log('  1. order.created');
  console.log('  2. order.updated');
  console.log('  3. order.cancelled');
  console.log('  4. order.completed');
  console.log('  5. Probar todos los eventos\n');

  // Para simplificar, probamos order.created
  const evento = 'order.created';
  console.log(`🎯 Evento seleccionado: ${evento}\n`);

  await dispararWebhook(ordenSeleccionada.id, evento);
  await verificarLogs(ordenSeleccionada.id);

  console.log('\n✅ Prueba completada!');
  console.log('\n💡 Consejos:');
  console.log('   - Revisa la terminal donde corre tu servidor webhook');
  console.log('   - Verifica los logs en Supabase (query de arriba)');
  console.log('   - Si no llega, revisa que el webhook esté registrado correctamente');
}

async function probarTodosLosEventos() {
  console.log('\n🧪 MODO: Probar todos los eventos\n');

  const ordenes = await consultarOrdenes();
  if (ordenes.length === 0) return;

  const ordenId = ordenes[0].id;
  const eventos = ['order.created', 'order.updated', 'order.cancelled', 'order.completed'];

  for (const evento of eventos) {
    await dispararWebhook(ordenId, evento);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo entre eventos
  }

  await verificarLogs(ordenId);
  console.log('\n✅ Todos los eventos probados!');
}

async function verificarConfiguracion() {
  console.log('\n🔍 Verificando configuración...\n');

  // 1. Verificar que el servidor webhook esté corriendo
  console.log('1. Verificando servidor webhook local...');
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Servidor webhook corriendo');
      console.log(`   🔐 Secret configurado: ${data.webhook_secret_configured ? 'Sí' : 'No'}`);
    } else {
      console.log('   ❌ Servidor no responde correctamente');
    }
  } catch (error) {
    console.log('   ❌ No se puede conectar al servidor webhook');
    console.log('   💡 Ejecuta: node scripts/webhook-server-example.js');
    return false;
  }

  // 2. Verificar que haya webhooks registrados
  console.log('\n2. Verificando webhooks registrados...');
  console.log('   📊 Ejecuta en Supabase SQL Editor:');
  console.log(`
   SELECT
     id,
     webhook_url,
     events,
     is_active,
     created_at
   FROM webhook_subscriptions
   WHERE is_active = true;
  `);

  console.log('\n   💡 Si no hay ninguno, registra uno con:');
  console.log(`
   INSERT INTO webhook_subscriptions (
     partner_id,
     webhook_url,
     events,
     secret_key,
     is_active
   ) VALUES (
     '00000000-0000-0000-0000-000000000000',
     'http://localhost:3001/webhooks/dogcatify',
     '["order.created", "order.updated", "order.cancelled", "order.completed"]'::jsonb,
     'tu-secret-key-aqui',
     true
   );
  `);

  return true;
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     🧪 Test de Integración de Webhooks - DogCatiFy 🧪    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    // Verificar configuración
    const configOk = await verificarConfiguracion();
    if (!configOk) {
      console.log('\n❌ Configuración incompleta. Por favor corrige los errores de arriba.\n');
      return;
    }

    // Mostrar menú
    console.log('\n┌───────────────────────────────────────────┐');
    console.log('│  Opciones:                                │');
    console.log('│  1. Probar un evento                      │');
    console.log('│  2. Probar todos los eventos              │');
    console.log('│  3. Solo consultar órdenes                │');
    console.log('└───────────────────────────────────────────┘\n');

    // Para simplificar, ejecutar opción 1
    await menuInteractivo();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Para probar todos los eventos, ejecuta:');
    console.log('   node scripts/test-webhook-integration.js --all');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Verifica:');
    console.error('   - Que el servidor webhook esté corriendo');
    console.error('   - Que haya webhooks registrados en la base de datos');
    console.error('   - Que las Edge Functions estén desplegadas\n');
  }
}

// Ejecutar
if (process.argv.includes('--all')) {
  probarTodosLosEventos().catch(console.error);
} else {
  main().catch(console.error);
}
