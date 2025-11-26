const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
);

async function testOnboarding() {
  console.log('=== Testing Onboarding System ===\n');

  const testEmail = `test.onboarding.${Date.now()}@example.com`;
  console.log(`Creating test user: ${testEmail}`);

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: {
        display_name: 'Test Onboarding User'
      }
    });

    if (authError) {
      console.error('Error creating user:', authError);
      return;
    }

    console.log('User created successfully:', authData.user.id);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
    }

    console.log('\nProfile created:');
    console.log('- ID:', profile.id);
    console.log('- Email:', profile.email || authData.user.email);
    console.log('- Display Name:', profile.display_name);
    console.log('- Onboarding Completed:', profile.onboarding_completed);
    console.log('- Onboarding Completed At:', profile.onboarding_completed_at);

    if (profile.onboarding_completed === false) {
      console.log('\n✅ SUCCESS: Onboarding flag is correctly set to false for new users');
    } else {
      console.log('\n❌ ERROR: Onboarding flag should be false for new users');
    }

    console.log('\n--- Simulating Onboarding Completion ---');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', authData.user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return;
    }

    const { data: updatedProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated profile:', fetchError);
      return;
    }

    console.log('\nUpdated Profile:');
    console.log('- Onboarding Completed:', updatedProfile.onboarding_completed);
    console.log('- Onboarding Completed At:', updatedProfile.onboarding_completed_at);

    if (updatedProfile.onboarding_completed === true && updatedProfile.onboarding_completed_at) {
      console.log('\n✅ SUCCESS: Onboarding completion works correctly');
    } else {
      console.log('\n❌ ERROR: Onboarding completion failed');
    }

    console.log('\n--- Cleanup: Deleting test user ---');

    const { error: deleteError } = await supabase.auth.admin.deleteUser(authData.user.id);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
    } else {
      console.log('Test user deleted successfully');
    }

    console.log('\n=== Onboarding Test Complete ===');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testOnboarding();
