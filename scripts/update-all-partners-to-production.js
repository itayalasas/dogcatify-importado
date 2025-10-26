const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function updateAllPartners() {
  // Credenciales de producción que funcionan
  const productionConfig = {
    access_token: 'APP_USR-5351471068765342-102713-e48a6adb69f0c5ff0dbf58a25a84bb41-535147106',
    public_key: 'APP_USR-88a45b7d-f0f0-453c-8d1f-0e1fa0dab211',
    is_test_mode: true,
    is_oauth: false,
    connected_at: new Date().toISOString()
  };

  // Obtener todos los partners con Mercado Pago conectado
  const { data: partners } = await supabase
    .from('partners')
    .select('id, business_name, mercadopago_config')
    .eq('mercadopago_connected', true);

  if (!partners) {
    console.log('No se encontraron partners');
    return;
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('🔄 ACTUALIZANDO TODOS LOS PARTNERS A PRODUCCIÓN');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total de partners: ${partners.length}\n`);

  let updated = 0;
  let skipped = 0;

  for (const partner of partners) {
    const currentToken = partner.mercadopago_config?.access_token || '';

    // Solo actualizar si tiene credenciales de test
    if (currentToken.startsWith('TEST-')) {
      console.log(`Actualizando: ${partner.business_name}`);

      const { error } = await supabase
        .from('partners')
        .update({
          mercadopago_config: productionConfig
        })
        .eq('id', partner.id);

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
      } else {
        console.log(`  ✅ Actualizado a PRODUCCIÓN`);
        updated++;
      }
    } else {
      console.log(`Saltando: ${partner.business_name} (ya tiene PRODUCCIÓN)`);
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 RESUMEN:');
  console.log(`  ✅ Partners actualizados: ${updated}`);
  console.log(`  ⏭️  Partners saltados: ${skipped}`);
  console.log(`  📱 Ahora TODOS abrirán la app de Mercado Pago`);
  console.log('═══════════════════════════════════════════════════════\n');
}

updateAllPartners()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
