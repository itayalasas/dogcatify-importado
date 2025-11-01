import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  species: 'dog' | 'cat';
  ageInMonths?: number;
  breed?: string;
  weight?: number;
  location?: string;
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
    const { species, ageInMonths, breed, weight, location } = body;

    const speciesText = species === 'dog' ? 'perro' : 'gato';
    const ageText = ageInMonths !== undefined
      ? `\nEdad: ${ageInMonths} meses (${(ageInMonths / 12).toFixed(1)} años)`
      : '';
    const breedText = breed ? `\nRaza: ${breed}` : '';
    const weightText = weight ? `\nPeso: ${weight} kg` : '';
    const locationText = location ? `\nUbicación: ${location}` : '';

    const prompt = `Eres un veterinario experto en parasitología veterinaria. Genera una lista COMPLETA de desparasitantes para esta mascota.

Mascota:
Especie: ${speciesText}${ageText}${breedText}${weightText}${locationText}

Genera un array JSON con TODOS los desparasitantes relevantes para esta especie y características. Para cada desparasitante incluye:

1. **name**: Nombre comercial del producto (ej: "Advantage II Gatos", "Advocate", "Revolution Plus")
2. **brand**: Marca (ej: "Bayer", "Elanco", "Zoetis")
3. **activeIngredient**: Principio activo (ej: "Imidacloprid + Piriproxifeno", "Selamectina")
4. **administrationMethod**: Método (oral, topical, injection, chewable)
5. **parasiteTypes**: Array con tipos de parásitos que trata (["Pulgas", "Garrapatas", "Lombrices intestinales", "Gusano del corazón"])
6. **frequency**: Frecuencia de aplicación (ej: "Mensual", "Cada 3 meses", "Cada 2 semanas")
7. **ageRecommendation**: Edad mínima recomendada (ej: "8 semanas en adelante", "6 meses en adelante")
8. **weightRange**: Rango de peso si aplica (ej: "2-4 kg", "4-8 kg", "Todos los pesos")
9. **prescriptionRequired**: true si requiere receta veterinaria
10. **commonSideEffects**: Array con efectos secundarios comunes (["Irritación local leve", "Vómitos", "Letargo temporal"])
11. **notes**: Notas adicionales importantes
12. **isRecommended**: true si es altamente recomendado para este caso específico

IMPORTANTE:
- Para GATOS incluye: Advantage II, Advocate, Revolution Plus, Profender, Drontal, Broadline, Bravecto Plus, Nexgard Combo
- Para PERROS incluye: NexGard, Simparica, Bravecto, Heartgard Plus, Sentinel, Revolution, Advantix, Drontal Plus
- Considera la edad: cachorros/gatitos necesitan productos seguros desde 6-8 semanas
- Considera el peso: algunos productos tienen diferentes presentaciones por rango de peso
- Incluye tanto opciones tópicas como orales
- Marca como "isRecommended: true" los 3-5 productos más apropiados para este caso

Frecuencias según edad y tipo:
- Cachorros/gatitos (<16 semanas): Desparasitación intestinal cada 2 semanas
- Jóvenes (4-12 meses): Desparasitación cada 4 semanas
- Adultos (>1 año): Desparasitación cada 3 meses
- Productos de pulgas/garrapatas: Mensual
- Prevención de gusano del corazón: Mensual

Formato de respuesta (SOLO JSON válido, sin texto adicional):
{
  "dewormers": [
    {
      "name": "Advantage II Gatos",
      "brand": "Bayer",
      "activeIngredient": "Imidacloprid + Piriproxifeno",
      "administrationMethod": "topical",
      "parasiteTypes": ["Pulgas", "Larvas de pulgas"],
      "frequency": "Mensual",
      "ageRecommendation": "8 semanas en adelante",
      "weightRange": "Todos los pesos",
      "prescriptionRequired": false,
      "commonSideEffects": ["Irritación local leve"],
      "notes": "Aplicar en la nuca, evitar que se lama",
      "isRecommended": true
    }
  ]
}`;

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
            content: 'Eres un veterinario experto en parasitología y medicina preventiva veterinaria. Generas información precisa y actualizada sobre desparasitantes. Siempre respondes en español y en formato JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
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
    const responseText = openaiData.choices[0].message.content;

    let dewormerData;
    try {
      dewormerData = JSON.parse(responseText);
    } catch (e) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        dewormerData = JSON.parse(match[0]);
      } else {
        throw new Error('No se pudo parsear la respuesta de OpenAI');
      }
    }

    let filteredDewormers = dewormerData.dewormers;

    if (ageInMonths !== undefined || weight !== undefined) {
      filteredDewormers = dewormerData.dewormers.map((dewormer: any) => {
        let priority = 'low';

        if (dewormer.isRecommended) {
          priority = 'high';
        } else if (dewormer.prescriptionRequired === false) {
          priority = 'medium';
        }

        return {
          ...dewormer,
          priority
        };
      });

      filteredDewormers.sort((a: any, b: any) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      });
    }

    return new Response(
      JSON.stringify({
        dewormers: filteredDewormers,
        species,
        ageInMonths,
        breed,
        weight,
        totalDewormers: filteredDewormers.length,
        recommendedDewormers: filteredDewormers.filter((d: any) => d.isRecommended).length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-dewormer-recommendations:', error);
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