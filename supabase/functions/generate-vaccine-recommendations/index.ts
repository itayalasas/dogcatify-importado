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
    const { species, ageInMonths, breed, location } = body;

    const speciesText = species === 'dog' ? 'perro' : 'gato';
    const ageText = ageInMonths !== undefined 
      ? `\nEdad: ${ageInMonths} meses (${(ageInMonths / 12).toFixed(1)} años)`
      : '';
    const breedText = breed ? `\nRaza: ${breed}` : '';
    const locationText = location ? `\nUbicación: ${location}` : '';

    const prompt = `Eres un veterinario experto en medicina preventiva. Genera una lista COMPLETA de vacunas para esta mascota.

Mascota:
Especie: ${speciesText}${ageText}${breedText}${locationText}

Genera un array JSON con TODAS las vacunas relevantes para esta especie. Para cada vacuna incluye:

1. **name**: Nombre corto de la vacuna (ej: "FVRCP", "Rabia", "Triple Felina")
2. **fullName**: Nombre completo con enfermedades que previene (ej: "FVRCP (Rinotraqueítis, Calicivirus, Panleucopenia)")
3. **description**: Descripción clara de para qué sirve (1-2 líneas)
4. **isEssential**: true si es vacuna esencial/obligatoria, false si es opcional
5. **frequency**: "Anual", "Cada 3 años", "Una vez", "Serie inicial + refuerzos", etc.
6. **recommendedAgeWeeks**: Array con las edades en semanas cuando se debe aplicar. Ejemplo: [6, 9, 12, 16] para una serie que empieza a las 6 semanas con refuerzos cada 3-4 semanas
7. **commonBrands**: Array con 2-4 marcas comerciales comunes
8. **sideEffects**: String con posibles efectos secundarios comunes
9. **notes**: Notas adicionales importantes

IMPORTANTE:
- Para GATOS incluye: FVRCP (esencial), Panleucopenia Felina, Rabia, Leucemia Felina (FeLV), Peritonitis Infecciosa Felina (PIF), Clamidia Felina, Bordetella
- Para PERROS incluye: Polivalente (Moquillo, Parvovirus, Hepatitis, Leptospirosis, Parainfluenza), Rabia, Tos de las Perreras (Bordetella), Coronavirus, Lyme, Leptospirosis
${ageInMonths !== undefined ? `- PRIORIZA las vacunas apropiadas para la edad actual (${ageInMonths} meses)` : ''}
- Las vacunas esenciales son obligatorias, las opcionales dependen del estilo de vida
- Incluye información sobre refuerzos y revacunaciones

Formato de respuesta (SOLO JSON válido, sin texto adicional):
{
  "vaccines": [
    {
      "name": "FVRCP",
      "fullName": "FVRCP (Rinotraqueítis, Calicivirus, Panleucopenia)",
      "description": "Vacuna combinada contra las principales enfermedades virales felinas",
      "isEssential": true,
      "frequency": "Anual",
      "recommendedAgeWeeks": [6, 9, 12, 16],
      "commonBrands": ["Nobivac Tricat", "Purevax FVRCP", "Fel-O-Vax"],
      "sideEffects": "Hinchazón local, Letargo temporal, Fiebre leve",
      "notes": "Serie inicial de 3-4 dosis, luego refuerzo anual"
    }
  ]
}`;

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
            content: 'Eres un veterinario experto en medicina preventiva y vacunación animal. Generas información precisa y actualizada sobre vacunas. Siempre respondes en español y en formato JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2500,
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

    // Parsear el JSON
    let vaccineData;
    try {
      // Intentar parsear directamente
      vaccineData = JSON.parse(responseText);
    } catch (e) {
      // Si falla, intentar extraer el JSON del texto
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        vaccineData = JSON.parse(match[0]);
      } else {
        throw new Error('No se pudo parsear la respuesta de OpenAI');
      }
    }

    // Filtrar vacunas por edad si se proporciona
    let filteredVaccines = vaccineData.vaccines;
    if (ageInMonths !== undefined) {
      const ageInWeeks = Math.floor(ageInMonths * 4.33);
      
      // Categorizar vacunas
      filteredVaccines = vaccineData.vaccines.map((vaccine: any) => {
        const minAge = Math.min(...vaccine.recommendedAgeWeeks);
        const maxAge = Math.max(...vaccine.recommendedAgeWeeks);
        
        let ageStatus = 'pending'; // pendiente, current (edad apropiada), overdue (atrasada), completed (ya debería tener)
        
        if (ageInWeeks < minAge) {
          ageStatus = 'pending';
        } else if (ageInWeeks >= minAge && ageInWeeks <= maxAge + 8) {
          ageStatus = 'current';
        } else if (ageInWeeks > maxAge + 8) {
          ageStatus = 'overdue';
        }
        
        return {
          ...vaccine,
          ageStatus,
          priority: vaccine.isEssential && (ageStatus === 'current' || ageStatus === 'overdue') ? 'high' : 
                   vaccine.isEssential ? 'medium' : 'low'
        };
      });
      
      // Ordenar por prioridad
      filteredVaccines.sort((a: any, b: any) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
      });
    }

    return new Response(
      JSON.stringify({ 
        vaccines: filteredVaccines,
        species,
        ageInMonths,
        totalVaccines: filteredVaccines.length,
        essentialVaccines: filteredVaccines.filter((v: any) => v.isEssential).length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-vaccine-recommendations:', error);
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
