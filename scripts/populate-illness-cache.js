/**
 * Script para pre-poblar TODOS los caches de IA con las razas más comunes
 * - Enfermedades (illnesses)
 * - Alergias (allergies)
 * - Desparasitantes (dewormers)
 *
 * Ejecutar: node scripts/populate-illness-cache.js
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('Asegúrate de tener EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env');
  process.exit(1);
}

// Razas más comunes por especie
const COMMON_BREEDS = {
  dog: [
    'Labrador Retriever',
    'Golden Retriever',
    'Pastor Alemán',
    'Bulldog Francés',
    'Beagle',
    'Yorkshire Terrier',
    'Poodle',
    'Chihuahua',
    'Rottweiler',
    'Boxer',
    'Dachshund',
    'Shih Tzu',
    'Siberian Husky',
    'Pomerania',
    'Boston Terrier',
    'Bulldog Inglés',
    'Cocker Spaniel',
    'Border Collie',
    'Doberman',
    'Schnauzer',
    'Mestizo' // Muy común en América Latina
  ],
  cat: [
    'Siamés',
    'Persa',
    'Maine Coon',
    'Bengalí',
    'Ragdoll',
    'British Shorthair',
    'Sphynx',
    'Abisinio',
    'Scottish Fold',
    'American Shorthair',
    'Europeo Común',
    'Mestizo' // Muy común
  ]
};

async function checkCacheExists(cacheTable, species, breed) {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${cacheTable}?species=eq.${species}&breed=eq.${encodeURIComponent(breed)}&select=id,created_at`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      }
    );

    const data = await response.json();
    return data && data.length > 0;
  } catch (error) {
    console.error(`Error checking ${cacheTable} cache for ${breed}:`, error.message);
    return false;
  }
}

async function generateDataForBreed(type, species, breed) {
  try {
    const typeNames = {
      'illnesses': 'enfermedades',
      'allergies': 'alergias',
      'dewormers': 'desparasitantes'
    };

    const endpoints = {
      'illnesses': 'generate-illness-recommendations',
      'allergies': 'generate-allergy-recommendations',
      'dewormers': 'generate-dewormer-recommendations'
    };

    console.log(`\n🔄 Generando ${typeNames[type]} para ${species}: ${breed}...`);

    // Edad y peso promedio para generar datos generales
    const defaultAge = 36; // 3 años (edad adulta promedio)
    const defaultWeight = species === 'dog' ? 15 : 4; // Peso promedio

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${endpoints[type]}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          species,
          breed,
          ageInMonths: defaultAge,
          weight: defaultWeight
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const count = result.illnesses?.length || result.allergies?.length || result.dewormers?.length || 0;
    console.log(`✅ Generadas ${count} ${typeNames[type]} para ${breed}`);

    return true;
  } catch (error) {
    console.error(`❌ Error generando ${type} para ${breed}:`, error.message);
    return false;
  }
}

async function populateCache() {
  console.log('🚀 Iniciando población de TODOS los caches de IA...\n');
  console.log('📊 Estadísticas:');
  console.log(`   - Razas de perros: ${COMMON_BREEDS.dog.length}`);
  console.log(`   - Razas de gatos: ${COMMON_BREEDS.cat.length}`);
  console.log(`   - Total: ${COMMON_BREEDS.dog.length + COMMON_BREEDS.cat.length} razas`);
  console.log(`   - Tipos de cache: 3 (enfermedades, alergias, desparasitantes)`);
  console.log(`   - Operaciones totales: ${(COMMON_BREEDS.dog.length + COMMON_BREEDS.cat.length) * 3}\n`);

  const cacheTables = {
    'illnesses': 'illnesses_ai_cache',
    'allergies': 'allergies_ai_cache',
    'dewormers': 'dewormers_ai_cache'
  };

  let stats = {
    illnesses: { total: 0, generated: 0, skipped: 0, errors: 0 },
    allergies: { total: 0, generated: 0, skipped: 0, errors: 0 },
    dewormers: { total: 0, generated: 0, skipped: 0, errors: 0 }
  };

  // Procesar perros
  console.log('🐕 Procesando razas de perros...');
  for (const breed of COMMON_BREEDS.dog) {
    for (const [type, tableName] of Object.entries(cacheTables)) {
      stats[type].total++;

      // Verificar si ya existe en cache
      const exists = await checkCacheExists(tableName, 'dog', breed);
      if (exists) {
        console.log(`⏭️  Saltando ${type} para ${breed} (ya existe en cache)`);
        stats[type].skipped++;
        continue;
      }

      const success = await generateDataForBreed(type, 'dog', breed);
      if (success) {
        stats[type].generated++;
      } else {
        stats[type].errors++;
      }

      // Pequeña pausa para no sobrecargar la API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Procesar gatos
  console.log('\n🐱 Procesando razas de gatos...');
  for (const breed of COMMON_BREEDS.cat) {
    for (const [type, tableName] of Object.entries(cacheTables)) {
      stats[type].total++;

      // Verificar si ya existe en cache
      const exists = await checkCacheExists(tableName, 'cat', breed);
      if (exists) {
        console.log(`⏭️  Saltando ${type} para ${breed} (ya existe en cache)`);
        stats[type].skipped++;
        continue;
      }

      const success = await generateDataForBreed(type, 'cat', breed);
      if (success) {
        stats[type].generated++;
      } else {
        stats[type].errors++;
      }

      // Pequeña pausa para no sobrecargar la API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(50));

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalProcessed = 0;

  for (const [type, stat] of Object.entries(stats)) {
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  ✅ Generadas: ${stat.generated}`);
    console.log(`  ⏭️  Saltadas: ${stat.skipped}`);
    console.log(`  ❌ Errores: ${stat.errors}`);
    console.log(`  📈 Total: ${stat.total}`);

    totalGenerated += stat.generated;
    totalSkipped += stat.skipped;
    totalErrors += stat.errors;
    totalProcessed += stat.total;
  }

  console.log('\n' + '='.repeat(50));
  console.log('TOTALES GLOBALES:');
  console.log(`✅ Generadas exitosamente: ${totalGenerated}`);
  console.log(`⏭️  Saltadas (ya existían): ${totalSkipped}`);
  console.log(`❌ Errores: ${totalErrors}`);
  console.log(`📈 Total procesadas: ${totalProcessed}`);
  console.log('='.repeat(50));

  if (totalErrors > 0) {
    console.log('\n⚠️  Algunas operaciones no se pudieron completar. Revisa los errores arriba.');
  } else {
    console.log('\n🎉 ¡Todos los caches poblados exitosamente! Los usuarios tendrán respuestas instantáneas.');
  }
}

// Ejecutar el script
populateCache().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});
