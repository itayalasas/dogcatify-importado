require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL y SUPABASE_ANON_KEY deben estar definidas en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAllergyCache() {
  console.log('🧪 Testing Allergy Cache System\n');

  // Test 1: Check existing cache
  console.log('📦 Test 1: Checking existing cache entries...');
  const { data: cacheEntries, error: cacheError } = await supabase
    .from('allergies_ai_cache')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (cacheError) {
    console.error('❌ Error fetching cache:', cacheError.message);
  } else {
    console.log(`✅ Found ${cacheEntries.length} cache entries`);
    cacheEntries.forEach((entry, index) => {
      const allergiesCount = Array.isArray(entry.allergies)
        ? entry.allergies.length
        : (typeof entry.allergies === 'string' ? JSON.parse(entry.allergies).length : 0);
      console.log(`   ${index + 1}. ${entry.species} - ${entry.breed} (${entry.age_in_months} months) - ${allergiesCount} allergies`);
      console.log(`      Cache key: ${entry.cache_key}`);
      console.log(`      Expires: ${new Date(entry.expires_at).toLocaleDateString()}`);
    });
  }

  // Test 2: Check for generic dog allergies
  console.log('\n🐕 Test 2: Checking generic dog allergies cache...');
  const genericDogKey = 'dog_Común/ Doméstico/ Mestizo_24_any';
  const { data: dogCache, error: dogError } = await supabase
    .from('allergies_ai_cache')
    .select('*')
    .eq('cache_key', genericDogKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (dogError) {
    console.error('❌ Error:', dogError.message);
  } else if (dogCache) {
    const allergies = typeof dogCache.allergies === 'string'
      ? JSON.parse(dogCache.allergies)
      : dogCache.allergies;
    console.log(`✅ Found cached generic dog allergies: ${allergies.length} entries`);
    console.log('   Sample allergies:');
    allergies.slice(0, 3).forEach((allergy, i) => {
      console.log(`   ${i + 1}. ${allergy.name} (${allergy.allergy_type}) - Severity: ${allergy.severity}`);
    });
  } else {
    console.log('ℹ️  No cache found for generic dog allergies (will be generated on first use)');
  }

  // Test 3: Check for generic cat allergies
  console.log('\n🐱 Test 3: Checking generic cat allergies cache...');
  const genericCatKey = 'cat_Común/ Doméstico/ Mestizo_24_any';
  const { data: catCache, error: catError } = await supabase
    .from('allergies_ai_cache')
    .select('*')
    .eq('cache_key', genericCatKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (catError) {
    console.error('❌ Error:', catError.message);
  } else if (catCache) {
    const allergies = typeof catCache.allergies === 'string'
      ? JSON.parse(catCache.allergies)
      : catCache.allergies;
    console.log(`✅ Found cached generic cat allergies: ${allergies.length} entries`);
    console.log('   Sample allergies:');
    allergies.slice(0, 3).forEach((allergy, i) => {
      console.log(`   ${i + 1}. ${allergy.name} (${allergy.allergy_type}) - Severity: ${allergy.severity}`);
    });
  } else {
    console.log('ℹ️  No cache found for generic cat allergies (will be generated on first use)');
  }

  // Test 4: Check cache expiration
  console.log('\n⏰ Test 4: Checking cache expiration status...');
  const { data: allCache, error: allError } = await supabase
    .from('allergies_ai_cache')
    .select('cache_key, expires_at, created_at');

  if (allError) {
    console.error('❌ Error:', allError.message);
  } else {
    const now = new Date();
    const valid = allCache.filter(c => new Date(c.expires_at) > now);
    const expired = allCache.filter(c => new Date(c.expires_at) <= now);
    console.log(`✅ Total cache entries: ${allCache.length}`);
    console.log(`   Valid: ${valid.length}`);
    console.log(`   Expired: ${expired.length}`);

    if (expired.length > 0) {
      console.log('\n   ⚠️  Expired entries (should be cleaned):');
      expired.forEach(e => {
        console.log(`      - ${e.cache_key} (expired ${new Date(e.expires_at).toLocaleDateString()})`);
      });
    }
  }

  // Test 5: Test structure of cached data
  console.log('\n📋 Test 5: Validating cache data structure...');
  if (cacheEntries && cacheEntries.length > 0) {
    const sample = cacheEntries[0];
    const allergies = typeof sample.allergies === 'string'
      ? JSON.parse(sample.allergies)
      : sample.allergies;

    if (Array.isArray(allergies) && allergies.length > 0) {
      const firstAllergy = allergies[0];
      const requiredFields = ['name', 'description', 'allergy_type', 'symptoms', 'severity', 'frequency', 'triggers', 'prevention_tips'];
      const hasAllFields = requiredFields.every(field => field in firstAllergy);

      if (hasAllFields) {
        console.log('✅ Cache data structure is valid');
        console.log('   Fields present:', Object.keys(firstAllergy).join(', '));
      } else {
        console.log('⚠️  Some fields are missing from cache data');
        const missing = requiredFields.filter(field => !(field in firstAllergy));
        console.log('   Missing:', missing.join(', '));
      }
    } else {
      console.log('⚠️  No allergies found in cache entry');
    }
  } else {
    console.log('ℹ️  No cache entries to validate');
  }

  console.log('\n✨ Allergy cache test completed!\n');
}

testAllergyCache().catch(console.error);
