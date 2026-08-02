import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  petName: string;
  species: 'dog' | 'cat';
  breed: string;
  gender: 'male' | 'female';
  ageMonths?: number;
  currentWeight: number;
  weightUnit: string;
  weightStatus: 'underweight' | 'ideal' | 'overweight';
  idealMin?: number;
  idealMax?: number;
  weightTrend?: 'increasing' | 'decreasing' | 'stable';
  weightDifference?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'OpenAI API key not configured',
          message: 'Por favor configura OPENAI_API_KEY en los secretos de Supabase',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RequestBody = await req.json();
    const {
      petName,
      species,
      breed,
      gender,
      ageMonths,
      currentWeight,
      weightUnit,
      weightStatus,
      idealMin,
      idealMax,
      weightTrend,
      weightDifference,
    } = body;

    const speciesText = species === 'dog' ? 'perro' : 'gato';
    const genderText = gender === 'male' ? 'macho' : 'hembra';
    const ageText = ageMonths ? `${(ageMonths / 12).toFixed(1)} años (${ageMonths} meses)` : 'desconocida';

    let statusText = '';
    let statusContext = '';
    if (weightStatus === 'underweight') {
      statusText = 'bajo peso';
      const deficit = idealMin ? (idealMin - currentWeight).toFixed(1) : null;
      statusContext = deficit
        ? `Le faltan aprox. ${deficit} ${weightUnit} para alcanzar el peso mínimo ideal de ${idealMin} ${weightUnit}.`
        : '';
    } else if (weightStatus === 'overweight') {
      statusText = 'sobrepeso';
      const excess = idealMax ? (currentWeight - idealMax).toFixed(1) : null;
      statusContext = excess
        ? `Tiene aprox. ${excess} ${weightUnit} por encima del peso máximo ideal de ${idealMax} ${weightUnit}.`
        : '';
    } else {
      statusText = 'peso ideal';
      statusContext = `Su peso está dentro del rango ideal (${idealMin}–${idealMax} ${weightUnit}).`;
    }

    let trendText = '';
    if (weightTrend && weightDifference !== undefined) {
      const diff = Math.abs(weightDifference).toFixed(1);
      if (weightTrend === 'increasing') trendText = `Tendencia: el peso ha aumentado ${diff} ${weightUnit} en el período analizado.`;
      else if (weightTrend === 'decreasing') trendText = `Tendencia: el peso ha disminuido ${diff} ${weightUnit} en el período analizado.`;
      else trendText = `Tendencia: el peso se ha mantenido estable.`;
    }

    const rangeText = idealMin && idealMax
      ? `Rango ideal para la raza: ${idealMin}–${idealMax} ${weightUnit}.`
      : '';

    const prompt = `Eres un veterinario nutricionista experto en salud de mascotas. Genera consejos personalizados sobre el peso de esta mascota.

Datos de la mascota:
- Nombre: ${petName}
- Especie: ${speciesText}
- Raza: ${breed}
- Sexo: ${genderText}
- Edad: ${ageText}
- Peso actual: ${currentWeight} ${weightUnit}
- Estado de peso: ${statusText}
- ${statusContext}
- ${rangeText}
${trendText ? `- ${trendText}` : ''}

Genera entre 5 y 7 consejos prácticos y personalizados considerando:
1. El estado de peso actual (${statusText}) y cuánto le falta o sobra
2. La raza y tamaño típico del animal
3. La edad (cachorro, adulto, senior)
4. Alimentación adecuada para normalizar el peso
5. Actividad física apropiada
6. Señales de alerta que el dueño debe monitorear
7. Cuándo acudir al veterinario

${weightStatus === 'underweight' ? 'IMPORTANTE: Da consejos específicos para aumentar peso de forma saludable. Menciona tipos de alimentos ricos en proteínas y grasas saludables para mascotas.' : ''}
${weightStatus === 'overweight' ? 'IMPORTANTE: Da consejos específicos para perder peso de forma segura. Menciona control de porciones, snacks saludables y ejercicio gradual. Advierte contra dietas bruscas.' : ''}
${weightStatus === 'ideal' ? 'IMPORTANTE: Da consejos para mantener el peso ideal. Incluye rutinas de alimentación y actividad que ayuden a sostener el buen estado.' : ''}

Usa emojis relevantes al inicio de cada consejo. Sé específico con cantidades, frecuencias y ejemplos concretos.

Formato: Devuelve SOLO un array JSON con los consejos como strings. Ejemplo:
["🥩 Primer consejo...", "🏃 Segundo consejo...", "💊 Tercer consejo..."]

IMPORTANTE: Responde en español, solo el array JSON válido, sin texto adicional.`;

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
            content: 'Eres un veterinario nutricionista especializado en salud y peso de mascotas. Generas consejos prácticos, específicos y basados en evidencia científica. Siempre respondes en español y en formato JSON válido.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'OpenAI API error', details: errorData }),
        { status: openaiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const tipsText = openaiData.choices[0].message.content;

    let tips: string[];
    try {
      tips = JSON.parse(tipsText);
    } catch (_e) {
      const match = tipsText.match(/\[([\s\S]*?)\]/);
      if (match) {
        tips = JSON.parse(match[0]);
      } else {
        tips = tipsText
          .split('\n')
          .filter((line: string) => line.trim().length > 0)
          .map((line: string) => line.replace(/^[0-9]+\.\s*/, '').trim())
          .filter((line: string) => line.length > 10);
      }
    }

    return new Response(
      JSON.stringify({ tips, model: 'gpt-4o-mini', petName, weightStatus }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-weight-advice:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
