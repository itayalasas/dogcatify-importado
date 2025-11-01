import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  species: 'dog' | 'cat';
  illnessName: string;
  ageInMonths: number;
  weight?: number;
}

interface Treatment {
  name: string;
  description: string;
  type: string;
  requires_prescription: boolean;
  dosage: string;
  duration: string;
  side_effects?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) {
      throw new Error("OPENAI_API_KEY no configurada");
    }

    const body: RequestBody = await req.json();
    const { species, illnessName, ageInMonths, weight } = body;

    if (!species || !illnessName || ageInMonths === undefined) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Generating treatment recommendations for ${illnessName} in ${species}, age: ${ageInMonths} months, weight: ${weight || 'N/A'}`);

    const speciesName = species === 'dog' ? 'perros' : 'gatos';
    const ageYears = Math.floor(ageInMonths / 12);
    const ageMonthsRemainder = ageInMonths % 12;
    const ageDescription = ageYears > 0
      ? `${ageYears} año${ageYears > 1 ? 's' : ''}${ageMonthsRemainder > 0 ? ` y ${ageMonthsRemainder} mes${ageMonthsRemainder > 1 ? 'es' : ''}` : ''}`
      : `${ageInMonths} mes${ageInMonths > 1 ? 'es' : ''}`;

    const weightInfo = weight ? ` y peso de ${weight}kg` : '';

    const prompt = `Eres un veterinario experto. Genera una lista de 8-12 tratamientos comunes y efectivos para "${illnessName}" en ${speciesName} de edad ${ageDescription}${weightInfo}.

Para cada tratamiento proporciona:
- name: nombre del medicamento o tratamiento
- description: breve descripción del propósito (máximo 80 caracteres)
- type: tipo (Medicamento, Suplemento, Terapia, Procedimiento, Cirugía, Cuidado en casa)
- requires_prescription: si requiere receta veterinaria (true/false)
- dosage: información de dosificación específica para esta edad y peso
- duration: duración típica del tratamiento
- side_effects: array de 2-4 efectos secundarios comunes (opcional)

Incluye una mezcla de:
- Medicamentos principales (antibióticos, analgésicos, antiinflamatorios, etc.)
- Tratamientos complementarios
- Cuidados de soporte

IMPORTANTE: Si no proporcionaste el peso, indica dosificaciones generales como "Según peso corporal" o "Según prescripción veterinaria".

Responde SOLO con un array JSON válido, sin texto adicional.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un veterinario experto que genera listas de tratamientos en formato JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No se recibió respuesta de OpenAI");
    }

    let treatments: Treatment[];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No se encontró JSON válido en la respuesta");
      }
      treatments = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      console.error("Content received:", content);
      throw new Error("Error al parsear la respuesta de OpenAI");
    }

    console.log(`Successfully generated ${treatments.length} treatment recommendations`);

    return new Response(
      JSON.stringify({ treatments }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error generando recomendaciones de tratamientos"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
