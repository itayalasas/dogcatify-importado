/**
 * Script para probar la conexión al API Gateway
 * Ejecutar: node scripts/test-api-gateway-connection.js
 */

const url = 'https://api.flowbridge.site/functions/v1/api-gateway/a3db1463-6c83-4eb0-bc6e-9ad7db89ea8e';
const apiKey = 'pub_4382560178cd0284e641e30eef20da87e3abde25937764c2d52e98b77a4d3f57';

console.log('🔍 Testing API Gateway connection...');
console.log('📡 URL:', url);
console.log('🔑 API Key:', apiKey.substring(0, 20) + '...');
console.log('');

async function testConnection() {
  try {
    console.log('⏳ Sending request...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Integration-Key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('📨 Response received:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   OK:', response.ok);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ Response data:');
    console.log('   Project Name:', data.project_name);
    console.log('   Description:', data.description);
    console.log('   Updated At:', data.updated_at);
    console.log('');

    if (data.variables) {
      console.log('📦 Variables received:');
      console.log('   EXPO_PUBLIC_SUPABASE_URL:', data.variables.EXPO_PUBLIC_SUPABASE_URL);
      console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', data.variables.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '(present)' : '(missing)');
      console.log('   Total variables:', Object.keys(data.variables).length);
      console.log('');
      console.log('   All variable keys:', Object.keys(data.variables).join(', '));
    } else {
      console.error('❌ No variables in response');
      process.exit(1);
    }

    console.log('');
    console.log('✅ API Gateway is working correctly!');

  } catch (error) {
    console.error('');
    console.error('❌ Error testing API Gateway:');
    console.error('   Name:', error.name);
    console.error('   Message:', error.message);

    if (error.name === 'AbortError') {
      console.error('   Reason: Request timeout (30 seconds)');
    } else if (error.message?.includes('fetch')) {
      console.error('   Reason: Network error - cannot reach the API Gateway');
      console.error('   Possible causes:');
      console.error('     - No internet connection');
      console.error('     - API Gateway URL is incorrect');
      console.error('     - CORS issues (if running from browser)');
      console.error('     - Firewall blocking the request');
    }

    process.exit(1);
  }
}

testConnection();
