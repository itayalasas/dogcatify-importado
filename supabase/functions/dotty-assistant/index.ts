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

    const { message, conversationHistory, userId } = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Obtener información del usuario y sus mascotas
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', userId)
      .single();

    const { data: pets } = await supabase
      .from('pets')
      .select('name, species, breed')
      .eq('owner_id', userId);

    // Construir el contexto del sistema
    const systemContext = `Eres Dotty, el asistente virtual amigable de DogCatiFy, una plataforma integral para el cuidado de mascotas. Tu personalidad es cálida, empática y entusiasta sobre las mascotas.

Usuario actual: ${profile?.display_name || 'Usuario'}
Mascotas registradas: ${pets && pets.length > 0 ? pets.map(p => `${p.name} (${p.species} - ${p.breed})`).join(', ') : 'Ninguna mascota registrada aún'}

Capacidades de DogCatiFy que puedes explicar:

1. **Mascotas** 🐾
   - Registrar y gestionar perfiles de mascotas
   - Historial médico completo (vacunas, desparasitaciones, alergias, enfermedades)
   - Álbumes de fotos y videos de sus mascotas
   - Seguimiento de peso y crecimiento
   - Compartir perfiles de mascotas con familiares/veterinarios
   - Generar PDF del historial médico

2. **Servicios Veterinarios** 🏥
   - Buscar veterinarias cercanas
   - Agendar citas con veterinarios
   - Servicios de peluquería, adiestramiento, guardería
   - Recomendaciones personalizadas de IA para cuidados

3. **Tienda** 🛒
   - Comprar productos para mascotas
   - Comida, juguetes, accesorios, medicamentos
   - Carritos de compra y pagos seguros
   - Seguimiento de pedidos

4. **Lugares Pet-Friendly** 📍
   - Descubrir lugares que aceptan mascotas
   - Parques, restaurantes, hoteles
   - Valoraciones y fotos de otros usuarios

5. **Red Social** 💬
   - Feed de publicaciones sobre mascotas
   - Compartir fotos y videos
   - Interactuar con otros dueños
   - Promociones y eventos especiales

6. **Adopción** 💕
   - Buscar mascotas en adopción
   - Contactar refugios y protectoras
   - Chat directo para coordinar adopciones

Instrucciones:
- Sé conversacional y amigable
- Usa emojis relacionados con mascotas (🐾 🐕 🐈 ❤️ 🎉)
- Da respuestas específicas y útiles sobre las funcionalidades
- Si el usuario pregunta algo que no sabes, sugiere explorar la app
- Personaliza tus respuestas según las mascotas del usuario
- Mantén las respuestas concisas (máximo 2-3 párrafos)
- Si es la primera conversación, preséntate brevemente y pregunta en qué puedes ayudar`;

    // Preparar mensajes para la IA
    const messages: Message[] = [
      { role: 'system', content: systemContext },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    // Llamar a OpenAI API (usando la key del entorno de Supabase)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      // Fallback a respuestas predefinidas si no hay API key
      const fallbackResponse = generateFallbackResponse(message, pets || []);
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
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 300,
        temperature: 0.8,
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

function generateFallbackResponse(message: string, pets: any[]): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('hola') || lowerMessage.includes('ayuda')) {
    return `¡Hola! 🐾 Soy Dotty, tu asistente en DogCatiFy. Estoy aquí para ayudarte con:\n\n• 📋 Gestionar el historial médico de tus mascotas\n• 🏥 Encontrar veterinarios y servicios\n• 🛒 Comprar productos para mascotas\n• 📍 Descubrir lugares pet-friendly\n• 💕 Y mucho más!\n\n¿Qué te gustaría hacer?`;
  }
  
  if (lowerMessage.includes('mascota') || lowerMessage.includes('perro') || lowerMessage.includes('gato')) {
    if (pets.length === 0) {
      return `Veo que aún no has registrado mascotas. 🐕🐈\n\nPuedes agregar tu primera mascota en la sección "Mascotas" del menú inferior. Podrás guardar su información, fotos, historial médico y mucho más. ¿Te gustaría que te guíe?`;
    } else {
      return `Tienes ${pets.length} mascota(s) registrada(s): ${pets.map(p => p.name).join(', ')}. 🐾\n\nPuedes ver su perfil completo, actualizar su historial médico, compartir su información con veterinarios, o crear álbumes de recuerdos. ¿Qué te gustaría hacer?`;
    }
  }
  
  if (lowerMessage.includes('veterinario') || lowerMessage.includes('servicio')) {
    return `En la sección "Servicios" puedes:\n\n🏥 Buscar veterinarias cercanas\n✂️ Encontrar peluquerías caninas\n🎓 Servicios de adiestramiento\n🏠 Guarderías y hoteles para mascotas\n\nTodos con valoraciones reales de usuarios. ¿Quieres que te muestre cómo agendar una cita?`;
  }
  
  if (lowerMessage.includes('comprar') || lowerMessage.includes('tienda') || lowerMessage.includes('producto')) {
    return `En nuestra Tienda 🛒 encontrarás:\n\n🍖 Comida y snacks\n🧸 Juguetes\n🦴 Accesorios\n💊 Productos de salud\n\nTodos los productos son de calidad verificada. Puedes agregar al carrito y pagar de forma segura. ¿Buscas algo en particular?`;
  }
  
  return `Estoy aquí para ayudarte con DogCatiFy. 🐾\n\nPuedo orientarte sobre:\n• Historial médico de mascotas\n• Buscar veterinarios y servicios\n• Comprar productos\n• Lugares pet-friendly\n• Y más funciones de la app\n\n¿En qué puedo asistirte?`;
}