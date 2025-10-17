/**
 * Script de prueba para la API de Órdenes
 *
 * Uso:
 *   node scripts/test-orders-api.js
 *
 * Asegúrate de configurar las variables de entorno:
 *   SUPABASE_URL=https://tu-proyecto.supabase.co
 *   API_KEY=tu-partner-id-uuid
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zkgiwamycbjcogcgqhff.supabase.co';
const API_KEY = process.env.API_KEY || '48bcaa28-23f5-4b92-b7cd-cd21c746e3a2'; // Reemplazar con tu Partner ID

async function testGetOrders() {
  console.log('\n=== TEST: Listar Órdenes ===\n');

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/orders-api?page=1&limit=5`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
        },
      }
    );

    console.log('Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('\nRespuesta:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`\n✅ Éxito: ${data.data.orders.length} órdenes encontradas`);
      console.log(`Total de órdenes: ${data.data.pagination.total}`);
      console.log(`Página: ${data.data.pagination.page} de ${data.data.pagination.total_pages}`);

      return data.data.orders[0]?.id; // Retornar el ID de la primera orden para el siguiente test
    } else {
      console.error('\n❌ Error:', data.error);
    }
  } catch (error) {
    console.error('\n❌ Error de red:', error.message);
  }

  return null;
}

async function testGetOrderById(orderId) {
  console.log('\n=== TEST: Obtener Orden Específica ===\n');

  if (!orderId) {
    console.log('⚠️  No hay orden para probar. Saltando test.');
    return;
  }

  try {
    console.log(`Obteniendo orden: ${orderId}`);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/orders-api/${orderId}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
        },
      }
    );

    console.log('Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('\nRespuesta:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      const order = data.data.order;
      console.log('\n✅ Éxito:');
      console.log(`  - ID: ${order.id}`);
      console.log(`  - Status: ${order.status}`);
      console.log(`  - Total: $${order.total_amount}`);
      console.log(`  - Cliente: ${order.customer?.full_name}`);
      console.log(`  - Fecha: ${order.created_at}`);
    } else {
      console.error('\n❌ Error:', data.error);
    }
  } catch (error) {
    console.error('\n❌ Error de red:', error.message);
  }
}

async function testFilterOrders() {
  console.log('\n=== TEST: Filtrar Órdenes por Status ===\n');

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/orders-api?status=completed&limit=3`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
        },
      }
    );

    console.log('Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('\nRespuesta:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`\n✅ Éxito: ${data.data.orders.length} órdenes completadas encontradas`);
    } else {
      console.error('\n❌ Error:', data.error);
    }
  } catch (error) {
    console.error('\n❌ Error de red:', error.message);
  }
}

async function testInvalidApiKey() {
  console.log('\n=== TEST: API Key Inválida ===\n');

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/orders-api`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': 'invalid-key-12345',
        },
      }
    );

    console.log('Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('\nRespuesta:');
    console.log(JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('\n✅ Éxito: Rechazó correctamente la API Key inválida');
    } else {
      console.error('\n❌ Error: Debería haber rechazado la API Key inválida');
    }
  } catch (error) {
    console.error('\n❌ Error de red:', error.message);
  }
}

async function testMissingApiKey() {
  console.log('\n=== TEST: Sin API Key ===\n');

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/orders-api`,
      {
        method: 'GET',
        headers: {},
      }
    );

    console.log('Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('\nRespuesta:');
    console.log(JSON.stringify(data, null, 2));

    if (response.status === 401) {
      console.log('\n✅ Éxito: Rechazó correctamente la petición sin API Key');
    } else {
      console.error('\n❌ Error: Debería haber rechazado la petición sin API Key');
    }
  } catch (error) {
    console.error('\n❌ Error de red:', error.message);
  }
}

// Ejecutar todos los tests
async function runAllTests() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   TEST API DE ÓRDENES - DOGCATIFY     ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`\nURL: ${SUPABASE_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}`);

  // Test 1: Listar órdenes
  const firstOrderId = await testGetOrders();

  // Test 2: Obtener orden específica
  await testGetOrderById(firstOrderId);

  // Test 3: Filtrar órdenes
  await testFilterOrders();

  // Test 4: API Key inválida
  await testInvalidApiKey();

  // Test 5: Sin API Key
  await testMissingApiKey();

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║          TESTS COMPLETADOS            ║');
  console.log('╚═══════════════════════════════════════╝\n');
}

// Ejecutar
runAllTests().catch(console.error);
