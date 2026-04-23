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

interface KnowledgeEntry {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  action?: string;
}

interface IntentRule {
  pattern: RegExp;
  knowledgeId: string;
}

const APP_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'pet-add',
    title: 'Agregar mascota',
    keywords: ['agregar mascota', 'crear mascota', 'registrar mascota', 'nueva mascota', 'sumar mascota'],
    answer:
      'Para registrar una mascota en DogCatiFy:\n' +
      '1) Ve a la pestaña "Mascotas".\n' +
      '2) Toca el botón "+" en la esquina superior derecha.\n' +
      '3) Carga foto (opcional) y completa nombre, especie, raza, edad, peso y género.\n' +
      '4) Guarda los cambios para crear el perfil.',
    action: 'add-pet',
  },
  {
    id: 'pet-album',
    title: 'Crear álbum de mascota',
    keywords: ['crear album', 'crear álbum', 'album mascota', 'fotos mascota', 'agregar fotos mascota'],
    answer:
      'Para crear un álbum de tu mascota:\n' +
      '1) Entra a "Mascotas" y abre el perfil de la mascota.\n' +
      '2) Ve a la sección de álbumes.\n' +
      '3) Toca "Agregar" para subir fotos o videos.\n' +
      '4) Completa título/descripción y guarda.',
    action: 'pets',
  },
  {
    id: 'pet-medical',
    title: 'Historial de salud',
    keywords: ['vacuna', 'vacunas', 'desparasitacion', 'desparasitación', 'alergia', 'enfermedad', 'peso mascota', 'historial medico', 'historial médico'],
    answer:
      'Para gestionar salud de tu mascota:\n' +
      '1) Abre la mascota en la pestaña "Mascotas".\n' +
      '2) Entra en Salud.\n' +
      '3) Elige vacunas, enfermedades, alergias, desparasitaciones o peso.\n' +
      '4) Carga fecha, datos y guarda para mantener el historial actualizado.',
    action: 'medical-history',
  },
  {
    id: 'pet-share',
    title: 'Compartir mascota',
    keywords: ['compartir mascota', 'invitar veterinario', 'invitar familiar mascota', 'pet share'],
    answer:
      'Para compartir una mascota con otra persona:\n' +
      '1) Entra al perfil de la mascota.\n' +
      '2) Usa la opción "Compartir mascota".\n' +
      '3) Indica el usuario y el nivel de permiso.\n' +
      '4) La otra persona recibe una invitación para aceptar o rechazar.',
    action: 'pets',
  },
  {
    id: 'shop-search-filter',
    title: 'Buscar y filtrar productos',
    keywords: ['buscar producto', 'filtrar tienda', 'categoria tienda', 'categoría tienda', 'como encontrar producto'],
    answer:
      'En Tienda puedes encontrar productos así:\n' +
      '1) Usa la barra de búsqueda para buscar por nombre.\n' +
      '2) Usa categorías (Comida, Juguetes, Accesorios, Salud, etc.).\n' +
      '3) Entra al detalle para ver precio, stock y descripción.',
    action: 'shop',
  },
  {
    id: 'shop-cart',
    title: 'Carrito y compra',
    keywords: ['agregar al carrito', 'carrito', 'comprar', 'checkout', 'finalizar compra', 'pagar tienda'],
    answer:
      'Para comprar en la tienda:\n' +
      '1) Abre un producto y toca "Agregar al carrito".\n' +
      '2) Entra al carrito para revisar cantidades.\n' +
      '3) Finaliza compra y completa el pago.\n' +
      '4) Puedes seguir el estado desde "Mis Pedidos".',
    action: 'shop',
  },
  {
    id: 'service-find',
    title: 'Encontrar servicios',
    keywords: ['buscar servicio', 'veterinaria', 'peluqueria', 'peluquería', 'pension', 'pensión', 'paseo', 'servicios'],
    answer:
      'Para encontrar servicios:\n' +
      '1) Ve a la pestaña "Servicios".\n' +
      '2) Busca por nombre/zona o usa categorías.\n' +
      '3) Abre el negocio para ver detalle, imágenes y reseñas.',
    action: 'services',
  },
  {
    id: 'service-book',
    title: 'Reservar servicio',
    keywords: ['reservar servicio', 'reserva veterinaria', 'agendar veterinaria', 'turno veterinaria', 'book service'],
    answer:
      'Para reservar un servicio (ej. veterinaria):\n' +
      '1) Entra al servicio o negocio desde "Servicios".\n' +
      '2) Toca "Reservar" en el detalle.\n' +
      '3) Selecciona la mascota.\n' +
      '4) Completa fecha/hora en el flujo de reserva y confirma.',
    action: 'services',
  },
  {
    id: 'ally-profile',
    title: 'Crear perfil de aliado',
    keywords: ['perfil de aliado', 'registro aliado', 'registrar negocio', 'partner', 'ser aliado', 'crear perfil partner', 'crear aliado', 'modo aliado'],
    answer:
      'Para crear tu perfil de aliado:\n' +
      '1) Ve a Perfil y entra en registro de negocio/aliado.\n' +
      '2) Completa datos del negocio, rubro, ubicación y contacto.\n' +
      '3) Guarda la solicitud.\n' +
      '4) Cuando esté habilitado, podrás gestionar servicios/productos desde modo aliado.',
    action: 'partner-register',
  },
  {
    id: 'ally-dashboard',
    title: 'Dashboard de aliado',
    keywords: ['dashboard aliado', 'dashboard partner', 'panel aliado', 'panel partner', 'ir al dashboard', 'dashboard negocio'],
    answer:
      'Para entrar al dashboard de aliado:\n' +
      '1) Ve a Perfil.\n' +
      '2) Toca "Ir al Dashboard de Aliado".\n' +
      '3) Se abrirá tu panel con métricas, pedidos y accesos a gestión.\n' +
      '4) Desde ahí puedes administrar tu negocio y revisar rendimiento.',
    action: 'partner-dashboard',
  },
  {
    id: 'profile-section',
    title: 'Sección Perfil',
    keywords: ['perfil', 'configuracion', 'configuración', 'mi cuenta', 'mi perfil'],
    answer:
      'En Perfil puedes gestionar tu cuenta y accesos:\n' +
      '1) Datos de cuenta y ajustes.\n' +
      '2) Mis pedidos y seguimiento.\n' +
      '3) Crear/gestionar modo aliado.\n' +
      '4) Crear/gestionar modo repartidor y ver pedidos de reparto.',
    action: 'profile',
  },
  {
    id: 'delivery-register',
    title: 'Configurar repartidor',
    keywords: ['repartidor', 'reparto', 'delivery register', 'perfil repartidor', 'convertirse en repartidor', 'gestionar reparto'],
    answer:
      'Para configurar tu perfil de repartidor:\n' +
      '1) Ve a Perfil > Modo Repartidor.\n' +
      '2) Elige modalidad: una tienda o múltiples tiendas.\n' +
      '3) Selecciona los negocios asociados.\n' +
      '4) Guarda la configuración para habilitar pedidos de reparto.',
    action: 'delivery-register',
  },
  {
    id: 'delivery-orders',
    title: 'Pedidos de reparto',
    keywords: ['pedidos de reparto', 'ordenes de reparto', 'órdenes de reparto', 'ver pedidos reparto', 'delivery orders'],
    answer:
      'Para gestionar pedidos de reparto:\n' +
      '1) Ve a Perfil > Modo Repartidor > Ver Pedidos de Reparto.\n' +
      '2) Verás pedidos "Listos para entrega" o "En reparto" asignados.\n' +
      '3) Toma el pedido y cámbialo a "En reparto".\n' +
      '4) Al entregar, márcalo como "Entregado".',
    action: 'delivery-orders',
  },
  {
    id: 'orders-track',
    title: 'Pedidos',
    keywords: ['mis pedidos', 'estado pedido', 'seguimiento pedido', 'ordenes', 'órdenes'],
    answer:
      'Para ver el estado de tus compras:\n' +
      '1) Ve a Perfil > Mis Pedidos.\n' +
      '2) Abre un pedido para ver detalle y estado.\n' +
      '3) También puedes revisar el carrito desde Perfil o Tienda.',
    action: 'orders',
  },
  {
    id: 'chat',
    title: 'Chat',
    keywords: ['chat', 'mensajes', 'hablar con tienda', 'contactar negocio'],
    answer:
      'DogCatiFy tiene chats para coordinar con negocios y contactos según el flujo.\n' +
      'Puedes abrir chat desde pantallas de detalle o rutas de conversación cuando estén disponibles.',
    action: 'services',
  },
];

const MEDICAL_AI_KEYWORDS = [
  'enfermedad', 'enfermo', 'sintoma', 'síntoma', 'diagnostico', 'diagnóstico', 'tratamiento', 'medicamento',
  'dosis', 'vomito', 'vómito', 'diarrea', 'fiebre', 'convulsion', 'convulsión', 'infeccion', 'infección',
  'emergencia', 'urgencia', 'veterinario urgente', 'toxico', 'tóxico', 'intoxicacion', 'intoxicación'
];

const HIGH_PRIORITY_INTENT_RULES: IntentRule[] = [
  {
    pattern: /(crear|registrar|hacer|activar).*(aliad|partner|negocio)|perfil.*(aliad|partner)|registro.*negocio/,
    knowledgeId: 'ally-profile',
  },
  {
    pattern: /(dashboard|panel).*(aliad|partner|negocio)|ir.*dashboard/,
    knowledgeId: 'ally-dashboard',
  },
  {
    pattern: /(repartidor|reparto|delivery).*(perfil|config|registr|convertir)|convertirse.*repartidor/,
    knowledgeId: 'delivery-register',
  },
  {
    pattern: /(pedidos|ordenes|órdenes).*(reparto|delivery)|delivery.*orders/,
    knowledgeId: 'delivery-orders',
  },
  {
    pattern: /(mi )?perfil|configuracion|configuración|cuenta/,
    knowledgeId: 'profile-section',
  },
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMedicalQuery(message: string): boolean {
  const normalized = normalizeText(message);
  return MEDICAL_AI_KEYWORDS.some((keyword) => normalized.includes(normalizeText(keyword)));
}

function resolveKnowledge(message: string): KnowledgeEntry | null {
  const normalized = normalizeText(message);
  let best: KnowledgeEntry | null = null;
  let bestScore = 0;

  for (const entry of APP_KNOWLEDGE) {
    const score = entry.keywords.reduce((acc, keyword) => {
      const key = normalizeText(keyword);
      return normalized.includes(key) ? acc + 1 : acc;
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore > 0 ? best : null;
}

function resolveHighPriorityIntent(message: string): KnowledgeEntry | null {
  const normalized = normalizeText(message);
  for (const rule of HIGH_PRIORITY_INTENT_RULES) {
    if (rule.pattern.test(normalized)) {
      return APP_KNOWLEDGE.find((entry) => entry.id === rule.knowledgeId) || null;
    }
  }
  return null;
}

function formatKnowledgeReply(userName: string, entry: KnowledgeEntry, alreadyHasPets: boolean, petNames: string[]): string {
  const personalizedIntro = alreadyHasPets
    ? `¡Hola, ${userName}! Veo que ya tienes ${petNames.join(', ')} 🐾\n\n`
    : `¡Hola, ${userName}! 🐾\n\n`;

  const actionLine = entry.action ? `\n\n[ACCIÓN: ${entry.action}]` : '';
  return `${personalizedIntro}${entry.answer}${actionLine}`;
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

6. **RUTEO DE RESPUESTA**:
   - Si la pregunta es de uso de la app (mascotas/tienda/servicios), prioriza pasos concretos y navegables.
   - Si la pregunta es médica (síntomas, enfermedades, tratamiento), sí usa razonamiento de IA, pero aclara que no reemplaza consulta veterinaria.

¡Sé el MEJOR asistente! 🐾✨`;

    const hasPets = !!pets && pets.length > 0;
    const petNames = hasPets ? pets.map((p: any) => p.name).filter(Boolean) : [];
    const forcedKnowledgeEntry = resolveHighPriorityIntent(message);
    const knowledgeEntry = forcedKnowledgeEntry || resolveKnowledge(message);
    const medicalQuery = isMedicalQuery(message);

    if (knowledgeEntry && !medicalQuery) {
      const deterministicReply = formatKnowledgeReply(userDisplayName, knowledgeEntry, hasPets, petNames);
      return new Response(
        JSON.stringify({ response: deterministicReply }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
    let assistantMessage = openaiData?.choices?.[0]?.message?.content || '';

    if (medicalQuery && assistantMessage) {
      assistantMessage += '\n\n⚠️ Nota: Esta orientación no reemplaza una consulta veterinaria profesional. Si hay urgencia, acude a una veterinaria de inmediato.';
    }

    if (!assistantMessage) {
      assistantMessage = generateFallbackResponse(
        message,
        pets || [],
        profile?.is_partner || false,
        partnerBusinesses,
        userDisplayName
      );
    }

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