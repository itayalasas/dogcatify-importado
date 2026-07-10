#!/usr/bin/env node

const https = require('https');

const API_GATEWAY_URL = 'https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/get-env';
const API_KEY = '3f74c928844b161da0fbb3d6a4bd19abc3b4e61024f2813a26ca66003dcd4fad';

console.log('🧪 Testing API Gateway...\n');
console.log('URL:', API_GATEWAY_URL);
console.log('API Key:', API_KEY.substring(0, 20) + '...\n');

const options = {
  method: 'GET',
  headers: {
    'X-Access-Key': API_KEY,
    'Content-Type': 'application/json'
  }
};

const req = https.request(API_GATEWAY_URL, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', JSON.stringify(res.headers, null, 2));
    console.log('\nResponse Body:');

    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));

      const variables = parsed.variables || parsed;

      console.log('\n✅ API Gateway Test Results:');
      console.log('  - EXPO_PUBLIC_SUPABASE_URL:', variables.EXPO_PUBLIC_SUPABASE_URL ? '✓ Present' : '✗ MISSING');
      console.log('  - EXPO_PUBLIC_SUPABASE_ANON_KEY:', variables.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✓ Present' : '✗ MISSING');

      if (variables.EXPO_PUBLIC_SUPABASE_URL) {
        console.log('  - URL value:', variables.EXPO_PUBLIC_SUPABASE_URL);
      }
      if (variables.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.log('  - Key value (first 50 chars):', variables.EXPO_PUBLIC_SUPABASE_ANON_KEY.substring(0, 50) + '...');
      }
    } catch (error) {
      console.log('Raw response:', data);
      console.error('\n❌ Error parsing JSON:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error.message);
});

req.end();
