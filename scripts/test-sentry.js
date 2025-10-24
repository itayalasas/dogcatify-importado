/**
 * Script para probar la integración de Sentry
 *
 * Este script simula errores que deberían ser capturados por Sentry
 * para verificar que la configuración está funcionando correctamente.
 *
 * Uso:
 *   node scripts/test-sentry.js
 */

console.log('Testing Sentry integration...');
console.log('This is a test script to verify Sentry is working.');
console.log('');
console.log('To test Sentry in your app:');
console.log('1. Add a button that throws an error: throw new Error("Test Sentry Error");');
console.log('2. Check your Sentry dashboard at: https://ayala-it-sas.sentry.io/issues/');
console.log('3. You should see the error appear within a few seconds');
console.log('');
console.log('Configuration complete! ✓');
