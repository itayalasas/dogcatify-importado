/**
 * Script para actualizar las credenciales de Mercado Pago de todos los partners
 *
 * USO:
 * 1. Obtén tus credenciales de producción de Mercado Pago
 * 2. Edita este archivo y pega tus credenciales en las líneas 12-13
 * 3. Ejecuta: node scripts/update-mercadopago-credentials.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ⚠️ PEGA TUS CREDENCIALES DE PRODUCCIÓN AQUÍ ⚠️
const YOUR_ACCESS_TOKEN = 'APP_USR-TU-ACCESS-TOKEN-AQUI';
const YOUR_PUBLIC_KEY = 'APP_USR-TU-PUBLIC-KEY-AQUI';

// ═══════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function updateCredentials() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔐 ACTUALIZANDO CREDENCIALES DE MERCADO PAGO');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Validar que las credenciales sean válidas
  if (!YOUR_ACCESS_TOKEN.startsWith('APP_USR-') || YOUR_ACCESS_TOKEN.includes('TU-ACCESS-TOKEN')) {
    console.error('❌ ERROR: Debes poner tu Access Token real en la línea 12');
    console.error('   El Access Token debe empezar con "APP_USR-"');
    console.error('   Obtén tus credenciales en: https://www.mercadopago.com.uy/developers/panel\n');
    process.exit(1);
  }

  if (!YOUR_PUBLIC_KEY.startsWith('APP_USR-') || YOUR_PUBLIC_KEY.includes('TU-PUBLIC-KEY')) {
    console.error('❌ ERROR: Debes poner tu Public Key real en la línea 13');
    console.error('   El Public Key debe empezar con "APP_USR-"');
    console.error('   Obtén tus credenciales en: https://www.mercadopago.com.uy/developers/panel\n');
    process.exit(1);
  }

  console.log('✅ Credenciales válidas detectadas');
  console.log('   Access Token:', YOUR_ACCESS_TOKEN.substring(0, 30) + '...');
  console.log('   Public Key:', YOUR_PUBLIC_KEY.substring(0, 30) + '...\n');

  // Configuración con tus credenciales reales
  const productionConfig = {
    access_token: YOUR_ACCESS_TOKEN,
    public_key: YOUR_PUBLIC_KEY,
    is_test_mode: true, // Usaremos modo test con credenciales de producción
    is_oauth: false,
    connected_at: new Date().toISOString()
  };

  // Obtener todos los partners con Mercado Pago
  const { data: partners, error: fetchError } = await supabase
    .from('partners')
    .select('id, business_name, mercadopago_connected, mercadopago_config')
    .eq('mercadopago_connected', true);

  if (fetchError) {
    console.error('❌ Error al obtener partners:', fetchError.message);
    process.exit(1);
  }

  if (!partners || partners.length === 0) {
    console.log('⚠️  No se encontraron partners con Mercado Pago configurado');
    process.exit(0);
  }

  console.log(`📋 Se encontraron ${partners.length} partner(s)\n`);

  let updated = 0;
  let errors = 0;

  for (const partner of partners) {
    console.log(`Actualizando: ${partner.business_name}`);

    const { error } = await supabase
      .from('partners')
      .update({
        mercadopago_connected: true,
        mercadopago_config: productionConfig
      })
      .eq('id', partner.id);

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errors++;
    } else {
      console.log(`  ✅ Actualizado correctamente`);
      updated++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN:');
  console.log(`  ✅ Partners actualizados: ${updated}`);
  console.log(`  ❌ Errores: ${errors}`);

  if (updated > 0) {
    console.log('\n🎉 ¡Credenciales actualizadas exitosamente!');
    console.log('📱 Ahora todos los partners usarán TUS credenciales de producción');
    console.log('✅ Los pagos se procesarán en tu cuenta de Mercado Pago');
    console.log('\n💳 Tarjetas de prueba para testear:');
    console.log('   VISA: 4509 9535 6623 3704');
    console.log('   Mastercard: 5031 7557 3453 0604');
    console.log('   CVV: 123, Vencimiento: 11/25');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

updateCredentials()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
