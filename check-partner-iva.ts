import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment variables!');
  console.log('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'NOT SET');
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'NOT SET');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPartnerIVA() {
  const { data, error } = await supabase
    .from('partners')
    .select('id, business_name, iva_rate, iva_included_in_price')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Partners IVA Configuration:');
  console.table(data);

  // Check if any partner has iva_included_in_price set
  const withIVAIncluded = data?.filter(p => p.iva_included_in_price === true);
  const withIVANotIncluded = data?.filter(p => p.iva_included_in_price === false);
  const withIVANull = data?.filter(p => p.iva_included_in_price === null);

  console.log(`\n📊 Summary:`);
  console.log(`  IVA Included (true): ${withIVAIncluded?.length || 0}`);
  console.log(`  IVA Not Included (false): ${withIVANotIncluded?.length || 0}`);
  console.log(`  IVA NULL: ${withIVANull?.length || 0}`);

  if ((withIVANull?.length || 0) > 0 || (withIVANotIncluded?.length || 0) > 0) {
    console.log('\n⚠️  WARNING: Some partners have iva_included_in_price as false or NULL!');
    console.log('   This will cause calculateIVA() to ADD IVA to prices again.');
  }
}

checkPartnerIVA();
