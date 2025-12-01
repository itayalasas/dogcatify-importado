#!/usr/bin/env node

const https = require('https');

const API_GATEWAY_URL = 'https://api.flowbridge.site/functions/v1/api-gateway/a3db1463-6c83-4eb0-bc6e-9ad7db89ea8e';
const API_KEY = 'pub_4382560178cd0284e641e30eef20da87e3abde25937764c2d52e98b77a4d3f57';

console.log('🧪 Testing API Gateway...\n');
console.log('URL:', API_GATEWAY_URL);
console.log('API Key:', API_KEY.substring(0, 20) + '...\n');

const options = {
  method: 'GET',
  headers: {
    'x-api-key': API_KEY,
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

      console.log('\n✅ API Gateway Test Results:');
      console.log('  - EXPO_PUBLIC_SUPABASE_URL:', parsed.EXPO_PUBLIC_SUPABASE_URL ? '✓ Present' : '✗ MISSING');
      console.log('  - EXPO_PUBLIC_SUPABASE_ANON_KEY:', parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✓ Present' : '✗ MISSING');

      if (parsed.EXPO_PUBLIC_SUPABASE_URL) {
        console.log('  - URL value:', parsed.EXPO_PUBLIC_SUPABASE_URL);
      }
      if (parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.log('  - Key value (first 50 chars):', parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY.substring(0, 50) + '...');
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
