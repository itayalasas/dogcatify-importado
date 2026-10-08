import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const VALID_CATEGORIES = ['park', 'restaurant', 'hotel', 'store', 'beach', 'cafe', 'vet'] as const;
type PlaceCategory = typeof VALID_CATEGORIES[number];

interface RequestBody {
  imageBase64: string;
  latitude?: number;
  longitude?: number;
}

interface VisionResult {
  name: string | null;
  category: PlaceCategory | null;
  visibleAddress: string | null;
  description: string | null;
  confidence: 'high' | 'medium' | 'low';
}

// Best-effort mapping from Google Places `types` to this app's category set.
const GOOGLE_TYPE_TO_CATEGORY: Record<string, PlaceCategory> = {
  park: 'park',
  dog_park: 'park',
  restaurant: 'restaurant',
  food: 'restaurant',
  meal_takeaway: 'restaurant',
  lodging: 'hotel',
  pet_store: 'store',
  store: 'store',
  shopping_mall: 'store',
  cafe: 'cafe',
  bakery: 'cafe',
  veterinary_care: 'vet',
  natural_feature: 'beach',
};

function mapGoogleTypesToCategory(types: string[] | undefined): PlaceCategory | null {
  if (!types) return null;
  for (const type of types) {
    if (GOOGLE_TYPE_TO_CATEGORY[type]) {
      return GOOGLE_TYPE_TO_CATEGORY[type];
    }
  }
  return null;
}

// Inverse mapping, used to bias a Nearby Search when no name was legible in
// the photo — we can still narrow the search by the kind of place it is.
const CATEGORY_TO_GOOGLE_TYPE: Record<PlaceCategory, string> = {
  park: 'park',
  restaurant: 'restaurant',
  hotel: 'lodging',
  store: 'pet_store',
  beach: 'tourist_attraction',
  cafe: 'cafe',
  vet: 'veterinary_care',
};

function normalizeCategory(value: string | null | undefined): PlaceCategory | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  return (VALID_CATEGORIES as readonly string[]).includes(normalized) ? (normalized as PlaceCategory) : null;
}

async function analyzeImageWithOpenAI(imageBase64: string, openaiApiKey: string): Promise<VisionResult> {
  const prompt = `Estás viendo una foto de un lugar pet-friendly (parque, restaurante, hotel, tienda, playa, cafetería o veterinaria).

Analiza la imagen y extrae, solo de lo que sea VISIBLE en la foto (carteles, fachada, letreros):
1. Nombre del lugar/negocio, si se lee en algún cartel o fachada.
2. Categoría más probable: una de park, restaurant, hotel, store, beach, cafe, vet.
3. Dirección visible, si hay algún texto de dirección legible.
4. Una descripción corta (1-2 frases) de lo que se ve en la foto.

Responde ÚNICAMENTE en JSON válido:
{
  "name": "nombre o null si no es legible",
  "category": "una de las categorías o null",
  "visibleAddress": "dirección visible o null",
  "description": "descripción corta",
  "confidence": "high/medium/low"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: 'Eres un asistente que identifica lugares pet-friendly a partir de fotos. Solo describes lo que es visible en la imagen, nunca inventas datos que no se puedan leer. Respondes siempre en español y en JSON válido.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content as string;

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No se pudo parsear la respuesta de OpenAI');
    parsed = JSON.parse(match[0]);
  }

  return {
    name: parsed.name || null,
    category: normalizeCategory(parsed.category),
    visibleAddress: parsed.visibleAddress || null,
    description: parsed.description || null,
    confidence: parsed.confidence || 'low',
  };
}

// Places API (New) — the legacy `maps.googleapis.com/maps/api/place/*`
// endpoints return REQUEST_DENIED on projects that only enabled "Places API
// (New)", which is what Google now provisions by default. This one call
// returns everything we need (address, phone, rating, location, types)
// directly, so no separate Details lookup is required.
const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const PLACE_FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.location,places.types';

interface GooglePlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  location?: { latitude: number; longitude: number };
  types?: string[];
}

async function searchGooglePlaceByText(
  name: string,
  latitude: number | undefined,
  longitude: number | undefined,
  apiKey: string,
): Promise<GooglePlaceResult | null> {
  const body: Record<string, unknown> = { textQuery: name };

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    body.locationBias = { circle: { center: { latitude, longitude }, radius: 2000 } };
  }

  const response = await fetch(`${PLACES_API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACE_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Places searchText error:', data.error?.message || data);
    return null;
  }

  return data?.places?.[0] || null;
}

async function searchNearestGooglePlace(
  category: PlaceCategory | null,
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<GooglePlaceResult | null> {
  const body: Record<string, unknown> = {
    locationRestriction: { circle: { center: { latitude, longitude }, radius: 3000 } },
    rankPreference: 'DISTANCE',
    maxResultCount: 1,
  };

  if (category && CATEGORY_TO_GOOGLE_TYPE[category]) {
    body.includedTypes = [CATEGORY_TO_GOOGLE_TYPE[category]];
  }

  const response = await fetch(`${PLACES_API_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACE_FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Places searchNearby error:', data.error?.message || data);
    return null;
  }

  return data?.places?.[0] || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured', message: 'Configura OPENAI_API_KEY en los secretos de Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body: RequestBody = await req.json();
    const { imageBase64, latitude, longitude } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const vision = await analyzeImageWithOpenAI(imageBase64, openaiApiKey);

    let googlePlace: GooglePlaceResult | null = null;
    const googlePlacesApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

    if (googlePlacesApiKey) {
      try {
        // Prefer matching by the name read off the photo, biased to the
        // device's location when we have it.
        googlePlace = vision.name
          ? await searchGooglePlaceByText(vision.name, latitude, longitude, googlePlacesApiKey)
          : null;

        // No legible name in the photo (or no match for it): fall back to
        // "what pet-friendly place of this category is closest to where the
        // photo was taken", using the device's GPS instead of the image.
        if (!googlePlace && hasCoords) {
          googlePlace = await searchNearestGooglePlace(vision.category, latitude!, longitude!, googlePlacesApiKey);
        }
      } catch (error) {
        console.error('Google Places lookup failed, continuing with AI-only data:', error);
      }
    }

    const coordinates = googlePlace?.location
      ? { latitude: googlePlace.location.latitude, longitude: googlePlace.location.longitude }
      : null;

    const result = {
      success: true,
      source: googlePlace ? 'ai_vision+google_places' : 'ai_vision_only',
      name: googlePlace?.displayName?.text || vision.name || '',
      category: mapGoogleTypesToCategory(googlePlace?.types) || vision.category || '',
      address: googlePlace?.formattedAddress || vision.visibleAddress || '',
      phone: googlePlace?.nationalPhoneNumber || '',
      rating: typeof googlePlace?.rating === 'number' ? googlePlace.rating : null,
      description: vision.description || '',
      coordinates,
      googlePlaceId: googlePlace?.id || null,
      confidence: vision.confidence,
      raw: { vision, googlePlace },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-place-photo:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
