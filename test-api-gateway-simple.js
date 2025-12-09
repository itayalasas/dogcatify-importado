// Test API Gateway connection
const API_GATEWAY_URL = 'https://api.flowbridge.site/functions/v1/api-gateway/a3db1463-6c83-4eb0-bc6e-9ad7db89ea8e';
const API_KEY = 'pub_4382560178cd0284e641e30eef20da87e3abde25937764c2d52e98b77a4d3f57';

async function testApiGateway() {
  console.log('🧪 Testing API Gateway...');
  console.log('URL:', API_GATEWAY_URL);
  console.log('API Key (first 20 chars):', API_KEY.substring(0, 20) + '...');
  console.log('');

  try {
    console.log('📡 Making request...');
    const response = await fetch(API_GATEWAY_URL, {
      method: 'GET',
      headers: {
        'X-Integration-Key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Success! Response received:');
    console.log('');
    console.log('Project Name:', data.project_name);
    console.log('Description:', data.description);
    console.log('Updated At:', data.updated_at);
    console.log('');
    console.log('Environment Variables received:');
    if (data.variables) {
      const keys = Object.keys(data.variables);
      console.log('Total variables:', keys.length);
      console.log('Keys:', keys.join(', '));
      console.log('');

      // Check critical variables
      const criticalVars = [
        'EXPO_PUBLIC_SUPABASE_URL',
        'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      ];

      console.log('Checking critical variables:');
      criticalVars.forEach(key => {
        const value = data.variables[key];
        console.log(`  ${key}: ${value ? '✅ Present' : '❌ Missing'}`);
      });
    } else {
      console.error('❌ No variables in response!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testApiGateway();
