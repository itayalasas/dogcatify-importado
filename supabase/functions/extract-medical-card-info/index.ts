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

interface ExtractedRecords {
  records: ExtractedData[];
  totalFound: number;
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

Analiza cuidadosamente esta imagen y extrae información de TODAS LAS VACUNAS visibles en el carnet.

Para cada vacuna encontrada, busca:

1. **Nombre de la vacuna** (ej: "DHPP", "Rabia", "Quíntuple", "Triple Felina", "FVRCP", etc.)
2. **Fecha de aplicación** (formato DD/MM/YYYY preferiblemente)
3. **Próxima dosis/refuerzo** (fecha cuando debe aplicarse la siguiente dosis)
4. **Nombre del veterinario** (Dr./Dra. + nombre)
5. **Clínica veterinaria** (nombre del establecimiento)
6. **Número de lote** de la vacuna si está visible
7. **Observaciones** o notas adicionales

IMPORTANTE:
- Extrae TODAS las vacunas que encuentres en la imagen (pueden ser múltiples filas, columnas o secciones)
- Cada vacuna debe ser un objeto separado en el array
- Las fechas deben estar en formato DD/MM/YYYY (ej: "15/03/2024")
- Si una fecha tiene 2 dígitos de año, asume 2000+ (ej: "15/03/24" → "15/03/2024")
- Busca variaciones como "próxima dosis", "refuerzo", "next dose", "revacunación"
- Si no puedes leer algo con claridad, déjalo vacío en ese registro específico
- Si el veterinario o clínica son los mismos para todas, repite la información en cada registro

Responde ÚNICAMENTE en formato JSON válido con un array:
{
  "records": [
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
  ],
  "totalFound": 0
}

Si no encuentras ninguna vacuna, retorna un array vacío con "totalFound": 0.`
      : `Eres un veterinario experto analizando un registro de desparasitación${petText} (${speciesText}).

Analiza cuidadosamente esta imagen y extrae información de TODAS LAS DESPARASITACIONES visibles en el registro.

Para cada desparasitación encontrada, busca:

1. **Producto/Desparasitante usado** (ej: "Drontal Plus", "Advocate", "Bravecto", "Milbemax", etc.)
2. **Fecha de aplicación** (formato DD/MM/YYYY preferiblemente)
3. **Próxima desparasitación** (fecha de la próxima dosis)
4. **Nombre del veterinario** (Dr./Dra. + nombre)
5. **Clínica veterinaria** (nombre del establecimiento)
6. **Tipo de parásitos tratados** (internos/externos, pulgas, garrapatas, etc.)
7. **Observaciones** o notas adicionales

IMPORTANTE:
- Extrae TODAS las desparasitaciones que encuentres en la imagen (pueden ser múltiples filas o entradas)
- Cada desparasitación debe ser un objeto separado en el array
- Las fechas deben estar en formato DD/MM/YYYY (ej: "15/03/2024")
- Si una fecha tiene 2 dígitos de año, asume 2000+ (ej: "15/03/24" → "15/03/2024")
- Busca palabras clave como "desparasitante", "antiparasitario", "vermífugo"
- Si no puedes leer algo con claridad, déjalo vacío en ese registro específico
- Si el veterinario o clínica son los mismos para todas, repite la información en cada registro

Responde ÚNICAMENTE en formato JSON válido con un array:
{
  "records": [
    {
      "productName": "Nombre del producto",
      "applicationDate": "DD/MM/YYYY",
      "nextDueDate": "DD/MM/YYYY",
      "veterinarian": "Dr./Dra. Nombre",
      "clinic": "Nombre de la clínica",
      "notes": "Tipo de parásitos tratados y observaciones",
      "confidence": "high/medium/low"
    }
  ],
  "totalFound": 0
}

Si no encuentras ninguna desparasitación, retorna un array vacío con "totalFound": 0.`;

    console.log('Calling OpenAI Vision API...');

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
        max_tokens: 2000,
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

    let extractedRecords: ExtractedRecords;
    try {
      const parsed = JSON.parse(responseText);
      extractedRecords = parsed;
    } catch (e) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        extractedRecords = parsed;
      } else {
        throw new Error('No se pudo parsear la respuesta de OpenAI');
      }
    }

    const processedRecords = extractedRecords.records.map((record: any) => {
      const processedRecord: ExtractedData = {
        type: recordType,
        ...record
      };

      if (processedRecord.applicationDate) {
        processedRecord.applicationDate = normalizeDateFormat(processedRecord.applicationDate);
      }
      if (processedRecord.nextDueDate) {
        processedRecord.nextDueDate = normalizeDateFormat(processedRecord.nextDueDate);
      }

      return processedRecord;
    });

    console.log(`Extracted ${processedRecords.length} ${recordType} records:`, processedRecords);

    return new Response(
      JSON.stringify({
        success: true,
        records: processedRecords,
        totalFound: extractedRecords.totalFound || processedRecords.length,
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

function normalizeDateFormat(dateStr: string): string {
  if (!dateStr) return '';

  dateStr = dateStr.trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    const year = parseInt(parts[2]);
    const fullYear = year > 50 ? `19${year}` : `20${year}`;
    return `${parts[0]}/${parts[1]}/${fullYear}`;
  }

  if (/^\d{2}[-\.]\d{2}[-\.]\d{4}$/.test(dateStr)) {
    return dateStr.replace(/[-\.]/g, '/');
  }

  if (/^\d{2}[-\.]\d{2}[-\.]\d{2}$/.test(dateStr)) {
    const parts = dateStr.split(/[-\.]/);
    const year = parseInt(parts[2]);
    const fullYear = year > 50 ? `19${year}` : `20${year}`;
    return `${parts[0]}/${parts[1]}/${fullYear}`;
  }

  if (/^\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}$/.test(dateStr)) {
    const parts = dateStr.split(/[\/\-\.]/);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return dateStr;
}
