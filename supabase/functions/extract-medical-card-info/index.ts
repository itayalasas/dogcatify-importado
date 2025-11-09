import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  imageBase64: string;
  recordType: 'vaccine' | 'deworming';
  petSpecies?: 'dog' | 'cat';
  petName?: string;
}

interface ExtractedData {
  type: 'vaccine' | 'deworming';
  name?: string;
  productName?: string;
  applicationDate?: string;
  nextDueDate?: string;
  veterinarian?: string;
  clinic?: string;
  batchNumber?: string;
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
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
    const { imageBase64, recordType, petSpecies, petName } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const recordTypeText = recordType === 'vaccine' ? 'vacunación' : 'desparasitación';
    const speciesText = petSpecies === 'dog' ? 'perro' : petSpecies === 'cat' ? 'gato' : 'mascota';
    const petText = petName ? ` de ${petName}` : '';

    const prompt = recordType === 'vaccine'
      ? `Eres un veterinario experto analizando un carnet de vacunación${petText} (${speciesText}).

Analiza cuidadosamente esta imagen y extrae TODA la información visible del carnet de vacunación.

Busca específicamente:

1. **Nombre de la vacuna** (ej: "DHPP", "Rabia", "Quíntuple", "Triple Felina", "FVRCP", etc.)
2. **Fecha de aplicación** (formato DD/MM/YYYY preferiblemente)
3. **Próxima dosis/refuerzo** (fecha cuando debe aplicarse la siguiente dosis)
4. **Nombre del veterinario** (Dr./Dra. + nombre)
5. **Clínica veterinaria** (nombre del establecimiento)
6. **Número de lote** de la vacuna si está visible
7. **Observaciones** o notas adicionales

IMPORTANTE:
- Si encuentras múltiples vacunas, extrae información de la MÁS RECIENTE o la que está más visible
- Las fechas deben estar en formato DD/MM/YYYY (ej: "15/03/2024")
- Si una fecha tiene 2 dígitos de año, asume 2000+ (ej: "15/03/24" → "15/03/2024")
- Busca variaciones como "próxima dosis", "refuerzo", "next dose", "revacunación"
- Si no puedes leer algo con claridad, déjalo vacío

Responde ÚNICAMENTE en formato JSON válido:
{
  "name": "Nombre de la vacuna",
  "applicationDate": "DD/MM/YYYY",
  "nextDueDate": "DD/MM/YYYY",
  "veterinarian": "Dr./Dra. Nombre",
  "clinic": "Nombre de la clínica",
  "batchNumber": "Número de lote",
  "notes": "Observaciones relevantes",
  "confidence": "high/medium/low"
}

Si no encuentras información en la imagen, indica "confidence": "low" y deja los campos vacíos.`
      : `Eres un veterinario experto analizando un registro de desparasitación${petText} (${speciesText}).

Analiza cuidadosamente esta imagen y extrae TODA la información visible del registro de desparasitación.

Busca específicamente:

1. **Producto/Desparasitante usado** (ej: "Drontal Plus", "Advocate", "Bravecto", "Milbemax", etc.)
2. **Fecha de aplicación** (formato DD/MM/YYYY preferiblemente)
3. **Próxima desparasitación** (fecha de la próxima dosis)
4. **Nombre del veterinario** (Dr./Dra. + nombre)
5. **Clínica veterinaria** (nombre del establecimiento)
6. **Tipo de parásitos tratados** (internos/externos, pulgas, garrapatas, etc.)
7. **Observaciones** o notas adicionales

IMPORTANTE:
- Si encuentras múltiples aplicaciones, extrae información de la MÁS RECIENTE
- Las fechas deben estar en formato DD/MM/YYYY (ej: "15/03/2024")
- Si una fecha tiene 2 dígitos de año, asume 2000+ (ej: "15/03/24" → "15/03/2024")
- Busca palabras clave como "desparasitante", "antiparasitario", "vermífugo"
- Si no puedes leer algo con claridad, déjalo vacío

Responde ÚNICAMENTE en formato JSON válido:
{
  "productName": "Nombre del producto",
  "applicationDate": "DD/MM/YYYY",
  "nextDueDate": "DD/MM/YYYY",
  "veterinarian": "Dr./Dra. Nombre",
  "clinic": "Nombre de la clínica",
  "notes": "Tipo de parásitos tratados y observaciones",
  "confidence": "high/medium/low"
}

Si no encuentras información en la imagen, indica "confidence": "low" y deja los campos vacíos.`;

    console.log('Calling OpenAI Vision API...');

    // Llamar a OpenAI Vision API
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
            content: `Eres un veterinario experto especializado en leer y analizar carnets de ${recordTypeText} de mascotas. Tu trabajo es extraer información precisa de las imágenes. Siempre respondes en español y en formato JSON válido.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 1000,
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

    console.log('OpenAI response:', responseText);

    // Parsear el JSON
    let extractedData: ExtractedData;
    try {
      // Intentar parsear directamente
      const parsed = JSON.parse(responseText);
      extractedData = {
        type: recordType,
        ...parsed
      };
    } catch (e) {
      // Si falla, intentar extraer el JSON del texto
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        extractedData = {
          type: recordType,
          ...parsed
        };
      } else {
        throw new Error('No se pudo parsear la respuesta de OpenAI');
      }
    }

    // Validar fechas y convertir formatos si es necesario
    if (extractedData.applicationDate) {
      extractedData.applicationDate = normalizeDateFormat(extractedData.applicationDate);
    }
    if (extractedData.nextDueDate) {
      extractedData.nextDueDate = normalizeDateFormat(extractedData.nextDueDate);
    }

    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        recordType,
        petSpecies,
        petName
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in extract-medical-card-info:', error);
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

/**
 * Normaliza el formato de fecha a DD/MM/YYYY
 */
function normalizeDateFormat(dateStr: string): string {
  if (!dateStr) return '';

  // Eliminar espacios
  dateStr = dateStr.trim();

  // Si ya está en formato DD/MM/YYYY, retornar
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // Si está en formato DD/MM/YY, convertir a DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    const year = parseInt(parts[2]);
    const fullYear = year > 50 ? `19${year}` : `20${year}`;
    return `${parts[0]}/${parts[1]}/${fullYear}`;
  }

  // Si está en formato DD-MM-YYYY o DD.MM.YYYY, convertir a DD/MM/YYYY
  if (/^\d{2}[-\.]\d{2}[-\.]\d{4}$/.test(dateStr)) {
    return dateStr.replace(/[-\.]/g, '/');
  }

  // Si está en formato DD-MM-YY o DD.MM.YY, convertir
  if (/^\d{2}[-\.]\d{2}[-\.]\d{2}$/.test(dateStr)) {
    const parts = dateStr.split(/[-\.]/);
    const year = parseInt(parts[2]);
    const fullYear = year > 50 ? `19${year}` : `20${year}`;
    return `${parts[0]}/${parts[1]}/${fullYear}`;
  }

  // Si está en formato YYYY/MM/DD o similar, convertir
  if (/^\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}$/.test(dateStr)) {
    const parts = dateStr.split(/[\/\-\.]/);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // Si no se puede normalizar, retornar tal cual
  return dateStr;
}
