/**
 * Script de prueba para validar la detección de ambiente (TEST vs PRODUCTION)
 * en las preferencias de pago de MercadoPago
 */

// Simular diferentes access_tokens
const testCases = [
  {
    name: 'TEST Token',
    access_token: 'TEST-1624486229466072-102600-62686a01a9ab41e8fc19800544564374-1876395148',
    expectedMode: true,
    expectedUrl: 'sandbox_init_point'
  },
  {
    name: 'APP Token (Production)',
    access_token: 'APP-1624486229466072-102600-62686a01a9ab41e8fc19800544564374-1876395148',
    expectedMode: false,
    expectedUrl: 'init_point'
  },
  {
    name: 'Legacy Token (Production)',
    access_token: '1624486229466072-102600-62686a01a9ab41e8fc19800544564374-1876395148',
    expectedMode: false,
    expectedUrl: 'init_point'
  }
];

// Función para detectar el modo de test
function isTestMode(accessToken) {
  return accessToken?.startsWith('TEST-');
}

// Simular respuesta de la API de MercadoPago
const mockPreference = {
  id: '1876395148-2721b916-380b-408e-a303-2fee54d1a2b3',
  init_point: 'https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=1876395148-2721b916-380b-408e-a303-2fee54d1a2b3',
  sandbox_init_point: 'https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=1876395148-2721b916-380b-408e-a303-2fee54d1a2b3'
};

console.log('=== Test de Detección de Ambiente MercadoPago ===\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Token: ${testCase.access_token.substring(0, 20)}...`);

  const isTest = isTestMode(testCase.access_token);
  const selectedUrl = isTest ? mockPreference.sandbox_init_point : mockPreference.init_point;

  console.log(`  Modo detectado: ${isTest ? 'TEST' : 'PRODUCTION'}`);
  console.log(`  URL seleccionada: ${testCase.expectedUrl}`);
  console.log(`  URL completa: ${selectedUrl}`);

  const passed = isTest === testCase.expectedMode;
  console.log(`  ✓ Resultado: ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
});

console.log('=== Resumen ===');
console.log('La lógica debe:');
console.log('1. Detectar si access_token comienza con "TEST-"');
console.log('2. Si es TEST, usar sandbox_init_point');
console.log('3. Si NO es TEST, usar init_point (producción)');
console.log('\nEsto evita la mezcla de ambientes que causa el error:');
console.log('"Una de las partes con la que intentas hacer el pago es de prueba."');
