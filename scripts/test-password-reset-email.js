/**
 * Script de prueba para enviar email de reseteo de contraseña
 *
 * Uso:
 * node scripts/test-password-reset-email.js
 */

const EMAIL_API_URL = 'https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email';
const EMAIL_API_KEY = 'sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee';

async function testPasswordResetEmail() {
  console.log('📧 === TESTING PASSWORD RESET EMAIL ===\n');

  const testData = {
    template_name: 'reset-password',
    recipient_email: 'payalaortiz@gmail.com',
    data: {
      client_name: 'Pedro Ayala Ortiz',
      reset_url: 'https://app-dogcatify.netlify.app/auth/reset-password?token=rpz481xagznmgqyzcmn'
    }
  };

  console.log('📧 Email Payload:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('\n📧 Sending request to:', EMAIL_API_URL);
  console.log('📧 Using API Key:', EMAIL_API_KEY.substring(0, 20) + '...\n');

  try {
    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EMAIL_API_KEY,
      },
      body: JSON.stringify(testData),
    });

    console.log('📧 Response Status:', response.status);
    console.log('📧 Response Status Text:', response.statusText);

    const responseText = await response.text();
    console.log('\n📧 Response Body:');
    console.log(responseText);

    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        console.log('\n✅ EMAIL SENT SUCCESSFULLY!');
        console.log('✅ Success:', result.success);
        console.log('✅ Message:', result.message);
        console.log('✅ Log ID:', result.log_id);
        console.log('✅ Processing Time:', result.processing_time_ms, 'ms');

        if (result.features) {
          console.log('\n📋 Features:');
          console.log('  - Has Attachment:', result.features.has_attachment);
          console.log('  - Has Logo:', result.features.has_logo);
          console.log('  - Has QR:', result.features.has_qr);
        }
      } catch (parseError) {
        console.log('\n⚠️ Response is not JSON, but request was successful');
      }
    } else {
      console.log('\n❌ EMAIL FAILED TO SEND');
      console.log('❌ Status:', response.status);
      console.log('❌ Error:', responseText);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

// Run the test
testPasswordResetEmail().catch(console.error);
