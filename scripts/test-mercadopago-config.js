const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testMercadoPagoConfig() {
  console.log('🧪 Testing Mercado Pago Configuration Save\n');

  const testPartnerId = 'cbad83bc-c019-412e-9391-95c55dbc8a97';

  const testConfig = {
    public_key: 'TEST-42c119b3-0534-42df-8eec-b58d14215fa0',
    access_token: 'TEST-7014566769079605-072823-7dbc2512afe8a0bbd20ea29e348bd00b-448163743',
    connected_at: new Date().toISOString(),
    is_test_mode: true
  };

  console.log('📝 Config to save:');
  console.log(JSON.stringify(testConfig, null, 2));
  console.log('\n');

  console.log('💾 Updating partner record...');
  const { data, error } = await supabase
    .from('partners')
    .update({
      mercadopago_connected: true,
      mercadopago_config: testConfig,
      updated_at: new Date().toISOString()
    })
    .eq('id', testPartnerId)
    .select();

  if (error) {
    console.error('❌ Error updating partner:', error);
    return;
  }

  console.log('✅ Partner updated successfully!');
  console.log('\n📊 Updated record:');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n');

  console.log('🔍 Verifying saved config...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('partners')
    .select('id, business_name, mercadopago_connected, mercadopago_config')
    .eq('id', testPartnerId)
    .single();

  if (verifyError) {
    console.error('❌ Error verifying:', verifyError);
    return;
  }

  console.log('✅ Verification successful!');
  console.log('\n📊 Stored config:');
  console.log(JSON.stringify(verifyData.mercadopago_config, null, 2));
  console.log('\n');

  const savedConfig = verifyData.mercadopago_config;
  const isValid =
    savedConfig.public_key === testConfig.public_key &&
    savedConfig.access_token === testConfig.access_token &&
    savedConfig.is_test_mode === testConfig.is_test_mode &&
    savedConfig.connected_at;

  if (isValid) {
    console.log('✅ All fields saved correctly!');
    console.log('✅ Structure matches expected format');
  } else {
    console.log('❌ Config structure mismatch!');
    console.log('Expected:', testConfig);
    console.log('Got:', savedConfig);
  }
}

testMercadoPagoConfig().catch(console.error);
