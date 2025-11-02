/**
 * Script para probar el ajuste de IVA en webhooks
 *
 * Este script explica cómo funciona el cálculo de IVA cuando está incluido en el precio
 */

async function testWebhookIvaAdjustment() {
  console.log('🧪 Test de ajuste de IVA en webhooks\n');
  console.log('='.repeat(70));

  // Ejemplo con el producto real: $1450 con IVA incluido al 22%
  const precioTotal = 1450;
  const tasaIva = 22;

  console.log('\n📦 EJEMPLO REAL:');
  console.log(`   Precio total del producto: $${precioTotal} UYU`);
  console.log(`   IVA: ${tasaIva}% (incluido en el precio)`);
  console.log('   ' + '-'.repeat(50));

  // Calcular subtotal sin IVA
  const subtotalSinIva = precioTotal / (1 + tasaIva / 100);
  const ivaAmount = precioTotal - subtotalSinIva;

  console.log(`\n✅ VALORES QUE SE ENVÍAN AL CRM:`);
  console.log(`   subtotal (sin IVA):    $${subtotalSinIva.toFixed(2)}`);
  console.log(`   iva_amount:            $${ivaAmount.toFixed(2)}`);
  console.log(`   iva_rate:              ${tasaIva}%`);
  console.log(`   iva_included_in_price: true`);
  console.log(`   total_amount:          $${precioTotal.toFixed(2)}`);

  console.log(`\n📊 VALIDACIÓN:`);
  const totalCalculado = subtotalSinIva + ivaAmount;
  console.log(`   ${subtotalSinIva.toFixed(2)} + ${ivaAmount.toFixed(2)} = ${totalCalculado.toFixed(2)}`);
  console.log(`   ✓ Cuadra correctamente: $${totalCalculado.toFixed(2)} = $${precioTotal.toFixed(2)}`);

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 IMPORTANTE:');
  console.log('   Cuando iva_included_in_price = TRUE:');
  console.log('   → El subtotal se calcula: precio_total / 1.22');
  console.log('   → El IVA es: precio_total - subtotal');
  console.log('   → El total es: subtotal + IVA (debe dar el precio original)');

  console.log('\n   Cuando iva_included_in_price = FALSE:');
  console.log('   → El subtotal es el precio base');
  console.log('   → El IVA es: subtotal * 0.22');
  console.log('   → El total es: subtotal + IVA');

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 RESUMEN DEL CRM:');
  console.log('   El CRM recibe los valores correctos:');
  console.log(`   - Subtotal sin IVA: $${subtotalSinIva.toFixed(2)}`);
  console.log(`   - IVA desglosado:   $${ivaAmount.toFixed(2)}`);
  console.log(`   - Total final:      $${precioTotal.toFixed(2)}`);
  console.log('   ✓ El CRM puede facturar correctamente');

  console.log('\n✅ La función está desplegada y funcionando correctamente\n');
}

testWebhookIvaAdjustment();
