/**
 * Script para verificar la configuración de Mercado Pago de los partners
 *
 * Este script te ayuda a diagnosticar por qué la app de Mercado Pago
 * se abre en servicios pero no en el carrito.
 *
 * USO:
 * 1. Asegúrate de tener las variables de entorno configuradas
 * 2. Ejecuta: node scripts/check-mercadopago-config.js
 */

const { createClient } = require('@supabase/supabase-js');

// Lee las variables de entorno del archivo .env
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY deben estar configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMercadoPagoConfig() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DE CONFIGURACIÓN DE MERCADO PAGO');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Obtener todos los partners con Mercado Pago configurado
    const { data: partners, error } = await supabase
      .from('partners')
      .select('id, business_name, mercadopago_connected, mercadopago_config')
      .eq('mercadopago_connected', true);

    if (error) {
      console.error('❌ Error al obtener partners:', error.message);
      return;
    }

    if (!partners || partners.length === 0) {
      console.log('⚠️  No se encontraron partners con Mercado Pago configurado');
      return;
    }

    console.log(`✅ Se encontraron ${partners.length} partner(s) con Mercado Pago configurado\n`);

    partners.forEach((partner, index) => {
      console.log('─'.repeat(60));
      console.log(`Partner ${index + 1}: ${partner.business_name}`);
      console.log('─'.repeat(60));
      console.log('ID:', partner.id);

      const config = partner.mercadopago_config;

      if (!config) {
        console.log('❌ No tiene configuración de Mercado Pago');
        console.log('');
        return;
      }

      // Analizar access_token
      const accessToken = config.access_token || '';
      const accessTokenPreview = accessToken.substring(0, 20) + '...';

      let environment = 'UNKNOWN';
      let urlDomain = 'UNKNOWN';
      let willOpenInApp = '❌';

      if (accessToken.startsWith('TEST-')) {
        environment = 'SANDBOX (Test)';
        urlDomain = 'sandbox.mercadopago.com.uy';
        willOpenInApp = '❌ NO (se abre en navegador)';
      } else if (accessToken.startsWith('APP_USR-')) {
        environment = 'PRODUCTION';
        urlDomain = 'www.mercadopago.com.uy';
        willOpenInApp = '✅ SÍ (se abre en la app)';
      }

      console.log('');
      console.log('📋 Configuración:');
      console.log('  Access Token:', accessTokenPreview);
      console.log('  Public Key:', config.public_key?.substring(0, 20) + '...' || 'N/A');
      console.log('  Ambiente:', environment);
      console.log('  Is Test Mode:', config.is_test_mode || false);
      console.log('  Is OAuth:', config.is_oauth || false);

      console.log('');
      console.log('🌐 Comportamiento esperado:');
      console.log('  URL que generará:', urlDomain);
      console.log('  ¿Se abrirá en la app?', willOpenInApp);

      if (environment === 'SANDBOX (Test)') {
        console.log('');
        console.log('⚠️  ADVERTENCIA:');
        console.log('  Este partner usa credenciales de SANDBOX');
        console.log('  Las URLs de sandbox NO abren la app de Mercado Pago');
        console.log('  Se abrirán en el navegador web');
        console.log('');
        console.log('💡 Solución:');
        console.log('  1. Cambia a credenciales de PRODUCCIÓN (APP_USR-XXX)');
        console.log('  2. Usa tarjetas de prueba para testear:');
        console.log('     • VISA: 4509 9535 6623 3704');
        console.log('     • Mastercard: 5031 7557 3453 0604');
        console.log('     • CVV: 123, Venc: 11/25');
      } else if (environment === 'PRODUCTION') {
        console.log('');
        console.log('✅ Este partner usa credenciales de PRODUCCIÓN');
        console.log('✅ La app de Mercado Pago se abrirá correctamente');
      }

      console.log('');
    });

    console.log('═'.repeat(60));
    console.log('\n📊 RESUMEN:');

    const sandboxPartners = partners.filter(p =>
      p.mercadopago_config?.access_token?.startsWith('TEST-')
    );
    const productionPartners = partners.filter(p =>
      p.mercadopago_config?.access_token?.startsWith('APP_USR-')
    );

    console.log(`  Partners en SANDBOX: ${sandboxPartners.length} (abre navegador)`);
    console.log(`  Partners en PRODUCTION: ${productionPartners.length} (abre app)`);

    if (sandboxPartners.length > 0 && productionPartners.length > 0) {
      console.log('');
      console.log('⚠️  ENCONTRADO EL PROBLEMA:');
      console.log('  Tienes partners con diferentes configuraciones');
      console.log('  Los partners en SANDBOX abren el navegador');
      console.log('  Los partners en PRODUCTION abren la app');
      console.log('');
      console.log('💡 SOLUCIÓN:');
      console.log('  Cambia todos los partners a PRODUCTION');
      console.log('  O asegúrate de usar el mismo partner en servicios y carrito');
    } else if (sandboxPartners.length > 0) {
      console.log('');
      console.log('⚠️  TODOS tus partners están en SANDBOX');
      console.log('  Por eso SIEMPRE se abre el navegador');
      console.log('');
      console.log('💡 SOLUCIÓN:');
      console.log('  Cambia a credenciales de PRODUCTION para que se abra la app');
    } else if (productionPartners.length > 0) {
      console.log('');
      console.log('✅ TODOS tus partners están en PRODUCTION');
      console.log('✅ La app debería abrirse correctamente');
    }

    console.log('');
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error.message);
  }
}

// Ejecutar el diagnóstico
checkMercadoPagoConfig().then(() => {
  console.log('\n✅ Diagnóstico completado\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
