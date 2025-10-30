require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testRegistration() {
  console.log('Testing user registration with trigger...');
  
  const testEmail = `test-${Date.now()}@dogcatify.com`;
  const testName = 'Test User Complete Name';
  const testPassword = 'test123456';
  
  console.log('\n1. Creating user with signUp...');
  console.log('Email:', testEmail);
  console.log('Full Name:', testName);
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: testName,
      },
      emailRedirectTo: undefined,
    },
  });
  
  if (authError) {
    console.error('❌ Auth error:', authError);
    return;
  }
  
  console.log('✅ User created:', authData.user.id);
  
  // Wait a moment for trigger to execute
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n2. Checking if profile was created by trigger...');
  
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();
  
  if (profileError) {
    console.error('❌ Profile error:', profileError);
    return;
  }
  
  console.log('✅ Profile found:');
  console.log('  - ID:', profileData.id);
  console.log('  - Email:', profileData.email);
  console.log('  - Display Name:', profileData.display_name);
  console.log('  - Is Owner:', profileData.is_owner);
  console.log('  - Is Partner:', profileData.is_partner);
  console.log('  - Email Confirmed:', profileData.email_confirmed);
  
  if (profileData.display_name === testName) {
    console.log('\n✅✅✅ SUCCESS! Display name was saved correctly!');
  } else {
    console.log('\n❌❌❌ FAIL! Display name does not match!');
    console.log('Expected:', testName);
    console.log('Got:', profileData.display_name);
  }
  
  // Clean up
  console.log('\n3. Cleaning up test user...');
  await supabase.auth.signOut();
}

testRegistration().catch(console.error);
