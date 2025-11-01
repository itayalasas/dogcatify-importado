/**
 * Script de prueba para la Edge Function de recomendaciones con IA
 *
 * Uso:
 *   node scripts/test-behavior-ai.js
 */

require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Datos de prueba
const testData = {
  petName: 'Niko',
  species: 'cat',
  breed: 'Gato Común',
  age: 2,
  weight: 2,
  traits: [
    { name: 'Energía', score: 3, description: 'Nivel de actividad y energía' },
    { name: 'Sociabilidad', score: 3, description: 'Interacción con otros animales y personas' },
    { name: 'Entrenabilidad', score: 3, description: 'Facilidad para aprender comandos' },
    { name: 'Agresividad', score: 3, description: 'Tendencia a mostrar comportamiento agresivo' },
    { name: 'Ansiedad', score: 3, description: 'Nivel de estrés y ansiedad' },
    { name: 'Protección', score: 3, description: 'Instinto protector hacia la familia' },
    { name: 'Independencia', score: 3, description: 'Capacidad de estar solo' },
    { name: 'Maullido', score: 3, description: 'Frecuencia e intensidad de maullidos' },
    { name: 'Arañado', score: 3, description: 'Tendencia a arañar muebles u objetos' }
  ],
  breedInfo: {
    playfulness: 3,
    intelligence: 3,
    meowing: 3,
    grooming: 2,
    shedding: 2,
    family_friendly: 4,
    children_friendly: 4,
    stranger_friendly: 3
  }
};

async function testBehaviorAI() {
  console.log('🧪 Probando Edge Function: generate-behavior-recommendations\n');
  console.log('📋 Datos de prueba:');
  console.log(`   Mascota: ${testData.petName} (${testData.species})`);
  console.log(`   Raza: ${testData.breed}`);
  console.log(`   Edad: ${testData.age} años, Peso: ${testData.weight} kg`);
  console.log(`   Traits evaluados: ${testData.traits.length}`);
  console.log('');

  try {
    console.log('⏳ Generando recomendaciones con IA...\n');

    const startTime = Date.now();

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-behavior-recommendations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(testData),
      }
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`⏱️  Tiempo de respuesta: ${duration}s`);
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Error:', errorData);

      if (errorData.message && errorData.message.includes('OPENAI_API_KEY')) {
        console.log('\n📝 ACCIÓN REQUERIDA:');
        console.log('   1. Ve al Dashboard de Supabase');
        console.log('   2. Settings → Edge Functions → Secrets');
        console.log('   3. Crea una variable llamada: OPENAI_API_KEY');
        console.log('   4. Pega tu API key de OpenAI (sk-proj-...)');
        console.log('   5. Guarda y vuelve a ejecutar este script\n');
      }

      return;
    }

    const data = await response.json();

    console.log('✅ Recomendaciones generadas exitosamente!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 RECOMENDACIONES GENERADAS CON IA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    data.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}\n`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📈 Estadísticas:`);
    console.log(`   Modelo usado: ${data.model}`);
    console.log(`   Total de recomendaciones: ${data.recommendations.length}`);
    console.log(`   Mascota: ${data.petName} (${data.species})`);

    console.log('\n✨ Prueba completada exitosamente!');

  } catch (error) {
    console.error('❌ Error al ejecutar la prueba:', error.message);

    if (error.message.includes('fetch')) {
      console.log('\n⚠️  Verifica que:');
      console.log('   1. EXPO_PUBLIC_SUPABASE_URL esté configurado en .env');
      console.log('   2. EXPO_PUBLIC_SUPABASE_ANON_KEY esté configurado en .env');
      console.log('   3. Tengas conexión a internet');
    }
  }
}

// Ejecutar el test
console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  TEST: Recomendaciones de Comportamiento con IA (OpenAI)  ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

testBehaviorAI();
