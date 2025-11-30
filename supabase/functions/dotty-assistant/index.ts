import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message, conversationHistory, userId, userName } = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, is_partner, is_admin, onboarding_completed')
      .eq('id', userId)
      .single();

    const userDisplayName = userName || profile?.display_name || 'Usuario';

    const { data: pets } = await supabase
      .from('pets')
      .select('name, species, breed')
      .eq('owner_id', userId);

    let partnerBusinesses = [];
    if (profile?.is_partner) {
      const { data: businesses } = await supabase
        .from('partners')
        .select('business_name, business_type, status')
        .eq('user_id', userId);
      partnerBusinesses = businesses || [];
    }

    const userRole = profile?.is_admin ? 'Administrador' : (profile?.is_partner ? 'Aliado/Partner' : 'Usuario');
    const businessInfo = partnerBusinesses.length > 0
      ? `\nNegocios registrados: ${partnerBusinesses.map(b => `${b.business_name} (${b.business_type} - ${b.status})`).join(', ')}`
      : '';

    const systemContext = `Eres Dotty, el asistente virtual inteligente de DogCatiFy. Tu personalidad es cálida, empática y profesional.

🔹 INFORMACIÓN DEL USUARIO:
Nombre: ${userDisplayName}
Rol: ${userRole}
Mascotas: ${pets && pets.length > 0 ? pets.map(p => `${p.name} (${p.species} - ${p.breed})`).join(', ') : 'Ninguna mascota registrada'}${businessInfo}
Onboarding completado: ${profile?.onboarding_completed ? 'Sí' : 'No'}

🎯 INSTRUCCIONES:

1. **PERSONALIZACIÓN**: SIEMPRE usa el nombre del usuario (${userDisplayName}). NUNCA digas "Usuario" o "Claro, Usuario".

2. **INTELIGENCIA CONTEXTUAL**:
   - Si YA TIENE MASCOTAS: NO expliques cómo agregar, habla de las mascotas existentes
   - Si pregunta "cómo agregar mascota" y YA TIENE: "Ya tienes a ${pets && pets.length > 0 ? pets.map(p => p.name).join(', ') : ''}. ¿Quieres agregar otra?"
   - Pasos REALES para agregar mascota:
     1. Ve a "Mascotas" (menú inferior)
     2. Toca el botón "+" (esquina superior derecha)
     3. Sube o toma foto
     4. Completa: Nombre, Especie, Raza (selector con búsqueda), Edad, Peso, Color, Género
     5. Opcional: Esterilizado, Chip, Descripción
     6. Toca "Guardar"

3. **RESPUESTAS**:
   - Máximo 4-5 párrafos
   - Usa listas numeradas
   - Emojis apropiados: 🐾 🐕 🐈 🏥 🛒

4. **ACCIONES**: Al final de explicaciones de "cómo hacer", sugiere: [ACCIÓN: nombre]
   - add-pet, services, shop, medical-history, partner-register, etc.

5. **NUNCA INVENTES**: Solo menciona funcionalidades reales de la app.

¡Sé el MEJOR asistente! 🐾✨`;

    const messages: Message[] = [
      { role: 'system', content: systemContext },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      const fallbackResponse = generateFallbackResponse(
        message,
        pets || [],
        profile?.is_partner || false,
        partnerBusinesses,
        userDisplayName
      );
      return new Response(
        JSON.stringify({ response: fallbackResponse }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    const openaiData = await openaiResponse.json();
    const assistantMessage = openaiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ response: assistantMessage }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in dotty-assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateFallbackResponse(
  message: string,
  pets: any[],
  isPartner: boolean,
  businesses: any[],
  userName: string
): string {
  const lowerMessage = message.toLowerCase();
  const greeting = `¡Hola, ${userName}!`;

  if (lowerMessage.includes('mascota') || lowerMessage.includes('agregar') || lowerMessage.includes('perro') || lowerMessage.includes('gato')) {
    if (pets.length > 0) {
      return `${greeting} Ya tienes ${pets.length} mascota(s) registrada(s): ${pets.map(p => p.name).join(', ')} 🐾\n\n¿Quieres:\n• Ver el perfil de alguna mascota?\n• Agregar otra mascota?\n• Actualizar su historial médico?\n\n[ACCIÓN: pets]`;
    } else {
      return `${greeting} Veo que aún no has registrado mascotas 🐕🐈\n\n📝 Para agregar tu primera mascota:\n1️⃣ Ve a "Mascotas" (menú inferior)\n2️⃣ Toca el botón "+" (esquina superior derecha)\n3️⃣ Sube o toma una foto\n4️⃣ Completa: Nombre, Especie, Raza, Edad, Peso, Color\n5️⃣ Toca "Guardar"\n\n[ACCIÓN: add-pet]`;
    }
  }

  return `${greeting} Soy Dotty, tu asistente personal 🐾. Puedo ayudarte con:\n\n• 📋 Mascotas e historial médico\n• 🏥 Encontrar veterinarios\n• 🛒 Comprar productos\n• 📍 Lugares pet-friendly\n• 💕 Adopción\n\n¿Qué necesitas?`;
}