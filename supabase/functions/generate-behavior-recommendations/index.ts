import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BehaviorTrait {
  name: string;
  score: number;
  description: string;
}

interface RequestBody {
  petName: string;
  species: 'dog' | 'cat';
  breed: string;
  age?: number;
  weight?: number;
  traits: BehaviorTrait[];
  breedInfo?: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured',
          message: 'Por favor configura OPENAI_API_KEY en los secretos de Supabase'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: RequestBody = await req.json();
    const { petName, species, breed, age, weight, traits, breedInfo } = body;

    // Construir el prompt para OpenAI
    const speciesText = species === 'dog' ? 'perro' : 'gato';
    const traitsText = traits.map(t => `- ${t.name}: ${t.score}/5 (${t.description})`).join('\n');
    
    let breedInfoText = '';
    if (breedInfo) {
      const relevantInfo = [];
      if (species === 'dog') {
        if (breedInfo.energy) relevantInfo.push(`Energía de raza: ${breedInfo.energy}/5`);
        if (breedInfo.trainability) relevantInfo.push(`Entrenabilidad de raza: ${breedInfo.trainability}/5`);
        if (breedInfo.shedding) relevantInfo.push(`Muda: ${breedInfo.shedding}/5`);
        if (breedInfo.grooming) relevantInfo.push(`Necesidad de grooming: ${breedInfo.grooming}/5`);
      } else {
        if (breedInfo.playfulness) relevantInfo.push(`Juguetón: ${breedInfo.playfulness}/5`);
        if (breedInfo.intelligence) relevantInfo.push(`Inteligencia: ${breedInfo.intelligence}/5`);
        if (breedInfo.meowing) relevantInfo.push(`Maullido: ${breedInfo.meowing}/5`);
        if (breedInfo.grooming) relevantInfo.push(`Cuidado del pelaje: ${breedInfo.grooming}/5`);
      }
      if (relevantInfo.length > 0) {
        breedInfoText = '\n\nInformación de la raza:\n' + relevantInfo.join('\n');
      }
    }

    const ageText = age ? `\nEdad: ${age} años` : '';
    const weightText = weight ? `\nPeso: ${weight} kg` : '';

    const prompt = `Eres un experto en comportamiento animal y etología. Analiza el perfil de comportamiento de esta mascota y genera recomendaciones específicas y accionables.

Mascota: ${petName}
Especie: ${speciesText}
Raza: ${breed}${ageText}${weightText}

Evaluación de comportamiento actual:
${traitsText}${breedInfoText}

Genera entre 5 y 8 recomendaciones personalizadas que:
1. Sean específicas para este ${speciesText} y su evaluación individual
2. Incluyan acciones concretas que el dueño puede implementar
3. Consideren tanto la raza como la evaluación personal
4. Prioricen el bienestar de la mascota
5. Sean prácticas y realizables
6. Usen emojis relevantes al inicio de cada recomendación

Formato: Devuelve SOLO un array JSON con las recomendaciones como strings. Ejemplo:
["🎯 Primera recomendación...", "🐕 Segunda recomendación...", "✨ Tercera recomendación..."]

IMPORTANTE: 
- Si hay valores altos de agresividad (4-5), SIEMPRE recomienda consultar con un profesional
- Si hay alta ansiedad (4-5), incluye técnicas específicas de manejo
- Para valores extremos (1-2 o 4-5), sé más específico en las recomendaciones
- Considera la combinación de traits para recomendaciones más personalizadas`;

    // Llamar a OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto veterinario y etólogo especializado en comportamiento animal. Generas recomendaciones prácticas, específicas y basadas en evidencia científica. Siempre respondes en español y en formato JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API error',
          details: errorData
        }),
        {
          status: openaiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const recommendationsText = openaiData.choices[0].message.content;

    // Parsear las recomendaciones
    let recommendations: string[];
    try {
      // Intentar parsear como JSON
      recommendations = JSON.parse(recommendationsText);
    } catch (e) {
      // Si falla, intentar extraer el array del texto
      const match = recommendationsText.match(/\[([\s\S]*?)\]/);
      if (match) {
        recommendations = JSON.parse(match[0]);
      } else {
        // Fallback: dividir por saltos de línea y limpiar
        recommendations = recommendationsText
          .split('\n')
          .filter((line: string) => line.trim().length > 0)
          .map((line: string) => line.replace(/^[0-9]+\.\s*/, '').replace(/^"-\s*/, '').trim())
          .filter((line: string) => line.length > 10);
      }
    }

    return new Response(
      JSON.stringify({ 
        recommendations,
        model: 'gpt-4o-mini',
        petName,
        species
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});