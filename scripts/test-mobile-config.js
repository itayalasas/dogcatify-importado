const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const anonKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '');

if (!url || !anonKey) {
  console.error('Define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const forbiddenKeys = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'EMAIL_API_KEY',
  'EXPO_PUBLIC_EMAIL_API_KEY',
  'FIREBASE_PRIVATE_KEY',
];

fetch(`${url}/functions/v1/mobile-config`, {
  headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
})
  .then(async (response) => {
    const body = await response.json();
    if (!response.ok) throw new Error(`mobile-config respondió ${response.status}`);
    const variables = body.variables || {};
    const exposed = forbiddenKeys.filter((key) => key in variables);
    if (exposed.length) throw new Error(`mobile-config expone claves prohibidas: ${exposed.join(', ')}`);
    console.log(`mobile-config OK: ${Object.keys(variables).length} valores públicos.`);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
