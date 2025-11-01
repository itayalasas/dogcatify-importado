import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  species: 'dog' | 'cat';
  breed: string;
  ageInMonths: number;
  weight?: number;
}

interface Allergy {
  name: string;
  description: string;
  allergy_type: string;
  symptoms: string[];
  severity: 'mild' | 'moderate' | 'severe';
  frequency: string;
  triggers: string[];
  prevention_tips: string[];
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
    const { species, breed, ageInMonths, weight } = body;

    if (!species || !breed || ageInMonths === undefined) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Generating allergy recommendations for ${species} - ${breed}, age: ${ageInMonths} months, weight: ${weight || 'N/A'}`);

    const speciesName = species === 'dog' ? 'perros' : 'gatos';
    const ageYears = Math.floor(ageInMonths / 12);
    const ageMonthsRemainder = ageInMonths % 12;
    const ageDescription = ageYears > 0
      ? `${ageYears} año${ageYears > 1 ? 's' : ''}${ageMonthsRemainder > 0 ? ` y ${ageMonthsRemainder} mes${ageMonthsRemainder > 1 ? 'es' : ''}` : ''}`
      : `${ageInMonths} mes${ageInMonths > 1 ? 'es' : ''}`;

    const weightInfo = weight ? ` y peso de ${weight}kg` : '';

    const prompt = `Eres un veterinario experto en alergias. Genera una lista de 10-15 alergias comunes y relevantes para ${speciesName} de raza ${breed}, edad ${ageDescription}${weightInfo}.

Para cada alergia proporciona:
- name: nombre claro de la alergia o alérgeno
- description: descripción breve de qué es y cómo afecta (máximo 100 caracteres)
- allergy_type: tipo de alergia (Alimentaria, Ambiental, Medicamento, Picaduras, Contacto, Estacional, Pulgas)
- symptoms: array de 3-5 síntomas típicos
- severity: nivel de gravedad típica (mild, moderate, severe)
- frequency: qué tan común es (Muy común, Común, Poco común)
- triggers: array de 2-4 desencadenantes específicos
- prevention_tips: array de 2-3 consejos de prevención

Considera:
- Las predisposiciones genéticas específicas de la raza ${breed}
- La edad ${ageDescription} (los cachorros y seniors tienen diferentes predisposiciones)
- Incluye tanto alergias alimentarias como ambientales
- Incluye alergias estacionales relevantes
- Considera alergias a productos de limpieza, plantas, insectos

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
            content: "Eres un veterinario experto que genera listas de alergias en formato JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
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

    let allergies: Allergy[];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No se encontró JSON válido en la respuesta");
      }
      allergies = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      console.error("Content received:", content);
      throw new Error("Error al parsear la respuesta de OpenAI");
    }

    console.log(`Successfully generated ${allergies.length} allergy recommendations`);

    return new Response(
      JSON.stringify({ allergies }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error generando recomendaciones de alergias"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
