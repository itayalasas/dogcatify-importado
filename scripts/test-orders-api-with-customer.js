#!/usr/bin/env node
/**
 * Script de prueba para la API de Órdenes con datos del cliente
 *
 * Este script demuestra cómo consultar órdenes y obtener
 * automáticamente los datos del cliente incluidos en la respuesta.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const API_KEY = process.env.ORDERS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !API_KEY) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY u ORDERS_API_KEY');
}

const API_BASE_URL = `${SUPABASE_URL}/functions/v1/orders-api`;

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║       🧪 TEST: API de Órdenes con Datos del Cliente      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

/**
 * Obtener todas las órdenes con datos del cliente
 */
async function testGetOrders() {
  console.log('\n📋 TEST 1: Obtener lista de órdenes con datos del cliente\n');

  try {
    const response = await fetch(`${API_BASE_URL}?page=1&limit=5`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Órdenes obtenidas exitosamente\n');
      console.log(`Total de órdenes: ${result.data.pagination.total}`);
      console.log(`Página: ${result.data.pagination.page}/${result.data.pagination.total_pages}\n`);

      if (result.data.orders.length > 0) {
        console.log('📦 Primeras órdenes:\n');
        result.data.orders.forEach((order, index) => {
          console.log(`${index + 1}. Orden ID: ${order.id}`);
          console.log(`   Status: ${order.status}`);
          console.log(`   Total: $${order.total_amount}`);
          console.log(`   Fecha: ${new Date(order.created_at).toLocaleString()}`);

          // Mostrar datos del cliente
          if (order.customer) {
            console.log(`   👤 Cliente:`);
            console.log(`      - Nombre: ${order.customer.full_name || 'N/A'}`);
            console.log(`      - Email: ${order.customer.email || 'N/A'}`);
            console.log(`      - Teléfono: ${order.customer.phone || 'N/A'}`);
            console.log(`      - Dirección: ${order.customer.address || 'N/A'}`);
            console.log(`      - Ciudad: ${order.customer.city || 'N/A'}`);
            console.log(`      - País: ${order.customer.country || 'N/A'}`);
          } else {
            console.log(`   ⚠️  Sin datos del cliente`);
          }
          console.log('');
        });

        // Retornar el ID de la primera orden para el siguiente test
        return result.data.orders[0].id;
      } else {
        console.log('ℹ️  No hay órdenes para mostrar\n');
        return null;
      }
    } else {
      console.error('❌ Error al obtener órdenes:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${result.error}`);
      console.error(`   Mensaje: ${result.message}\n`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error de red:', error.message, '\n');
    return null;
  }
}

/**
 * Obtener una orden específica con datos del cliente
 */
async function testGetOrderById(orderId) {
  console.log(`\n📄 TEST 2: Obtener orden específica con datos del cliente\n`);
  console.log(`Consultando orden: ${orderId}\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/${orderId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Orden obtenida exitosamente\n');

      const order = result.data.order;

      console.log('📦 Detalles de la orden:\n');
      console.log(`   ID: ${order.id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: $${order.total_amount}`);
      console.log(`   Tipo: ${order.order_type || 'N/A'}`);
      console.log(`   Fecha: ${new Date(order.created_at).toLocaleString()}`);

      // Mostrar datos completos del cliente
      if (order.customer) {
        console.log(`\n   👤 DATOS DEL CLIENTE (para CRM):`);
        console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   ID: ${order.customer.id}`);
        console.log(`   Nombre completo: ${order.customer.full_name || 'N/A'}`);
        console.log(`   Email: ${order.customer.email || 'N/A'}`);
        console.log(`   Teléfono: ${order.customer.phone || 'N/A'}`);
        console.log(`   Dirección: ${order.customer.address || 'N/A'}`);
        console.log(`   Ciudad: ${order.customer.city || 'N/A'}`);
        console.log(`   País: ${order.customer.country || 'N/A'}`);
        console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        // Mostrar formato para CRM
        console.log('   💡 Estructura para tu CRM:');
        console.log(JSON.stringify({
          external_id: order.id,
          contact_name: order.customer.full_name,
          email: order.customer.email,
          phone: order.customer.phone,
          address: order.customer.address,
          city: order.customer.city,
          country: order.customer.country,
          source: 'dogcatify',
          status: 'active',
        }, null, 2));
      } else {
        console.log(`\n   ⚠️  Sin datos del cliente\n`);
      }

      // Mostrar items de la orden
      if (order.items && order.items.length > 0) {
        console.log(`\n   📦 Items (${order.items.length}):`);
        order.items.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.name || 'Producto'} - $${item.price} x ${item.quantity}`);
        });
      }

      console.log('');
    } else {
      console.error('❌ Error al obtener orden:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${result.error}`);
      console.error(`   Mensaje: ${result.message}\n`);
    }
  } catch (error) {
    console.error('❌ Error de red:', error.message, '\n');
  }
}

/**
 * Crear una orden de prueba
 */
async function createTestOrder() {
  console.log('\n🆕 Creando orden de prueba para demostrar webhook...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Obtener un usuario de prueba
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'user')
      .limit(1);

    if (!profiles || profiles.length === 0) {
      console.log('⚠️  No hay usuarios disponibles para crear orden de prueba\n');
      return null;
    }

    // Obtener un partner
    const { data: partners } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'partner')
      .limit(1);

    if (!partners || partners.length === 0) {
      console.log('⚠️  No hay partners disponibles\n');
      return null;
    }

    const orderData = {
      partner_id: partners[0].id,
      customer_id: profiles[0].id,
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
  } catch (error) {
    console.error('❌ Error:', error.message, '\n');
    return null;
  }
}

/**
 * Ejecutar todos los tests
 */
async function runAllTests() {
  console.log(`🔑 Usando API Key: ${API_KEY.substring(0, 20)}...`);
  console.log(`🌐 API URL: ${API_BASE_URL}\n`);

  // Test 1: Obtener lista de órdenes
  const firstOrderId = await testGetOrders();

  // Test 2: Obtener orden específica (si hay alguna)
  if (firstOrderId) {
    await testGetOrderById(firstOrderId);
  } else {
    console.log('ℹ️  Creando orden de prueba...\n');
    const testOrderId = await createTestOrder();
    if (testOrderId) {
      await testGetOrderById(testOrderId);
    }
  }

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    ✅ Tests Completados                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

// Ejecutar tests
runAllTests().catch(console.error);
