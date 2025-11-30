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

    // Obtener información completa del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, is_partner, is_admin, onboarding_completed')
      .eq('id', userId)
      .single();

    // Usar el nombre pasado desde el frontend, o el del perfil como fallback
    const userDisplayName = userName || profile?.display_name || 'Usuario';

    const { data: pets } = await supabase
      .from('pets')
      .select('name, species, breed')
      .eq('owner_id', userId);

    // Si es partner, obtener información de sus negocios
    let partnerBusinesses = [];
    if (profile?.is_partner) {
      const { data: businesses } = await supabase
        .from('partners')
        .select('business_name, business_type, status')
        .eq('user_id', userId);
      partnerBusinesses = businesses || [];
    }

    // Construir el contexto del sistema COMPLETO
    const userRole = profile?.is_admin ? 'Administrador' : (profile?.is_partner ? 'Aliado/Partner' : 'Usuario');
    const businessInfo = partnerBusinesses.length > 0
      ? `\nNegocios registrados: ${partnerBusinesses.map(b => `${b.business_name} (${b.business_type} - ${b.status})`).join(', ')}`
      : '';

    const systemContext = `Eres Dotty, el asistente virtual inteligente de DogCatiFy, una plataforma integral para el cuidado de mascotas. Tu personalidad es cálida, empática, profesional y experta en TODAS las funcionalidades de la app.

🔹 INFORMACIÓN DEL USUARIO:
Nombre: ${userDisplayName}
Rol: ${userRole}
Mascotas: ${pets && pets.length > 0 ? pets.map(p => `${p.name} (${p.species} - ${p.breed})`).join(', ') : 'Ninguna mascota registrada'}${businessInfo}
Onboarding completado: ${profile?.onboarding_completed ? 'Sí' : 'No'}

🔹 FUNCIONALIDADES COMPLETAS DE LA APP:

═══════════════════════════════════════════════════════════════════
📱 PARA USUARIOS NORMALES:
═══════════════════════════════════════════════════════════════════

1️⃣ **GESTIÓN DE MASCOTAS** 🐾
   Ruta: (tabs)/pets
   • Registrar nuevas mascotas con foto, nombre, especie, raza, fecha de nacimiento
   • Ver lista de todas sus mascotas
   • Editar información de cada mascota
   • Eliminar mascotas

   SUB-FUNCIONALIDADES:
   a) **Historial Médico Completo** 📋
      • Vacunas con fecha, tipo, veterinario, próxima dosis
      • Desparasitaciones con producto, fecha, peso
      • Alergias y tratamientos
      • Enfermedades y diagnósticos
      • Visitas veterinarias
      • Seguimiento de peso y crecimiento
      • Generar PDF profesional del historial completo

   b) **Álbumes de Fotos y Videos** 📸
      Ruta: pets/albums/[id]
      • Crear álbumes temáticos
      • Subir fotos y videos ilimitados
      • Organizar recuerdos por fecha

   c) **Compartir Información** 🔗
      Ruta: pets/share-pet, pets/share-medical-history
      • Compartir perfil completo con familiares
      • Compartir historial médico con veterinarios
      • Generar tokens seguros de acceso temporal
      • Control de permisos (solo lectura)

   d) **Análisis con IA** 🤖
      • Recomendaciones personalizadas de vacunas
      • Alertas de próximas desparasitaciones
      • Consejos según raza y edad
      • Detección de problemas de comportamiento

2️⃣ **SERVICIOS VETERINARIOS Y MÁS** 🏥
   Ruta: (tabs)/services
   • Buscar veterinarias cercanas con mapa
   • Peluquerías caninas y felinas
   • Adiestradores profesionales
   • Guarderías y hoteles para mascotas (boarding)
   • Paseadores de perros
   • Spas y centros de estética
   • Servicios a domicilio

   AGENDAR CITAS:
   Ruta: services/booking/[serviceId]
   • Ver disponibilidad en calendario
   • Seleccionar fecha y hora
   • Elegir mascota y servicio específico
   • Pagar online o en el lugar
   • Confirmación automática
   • Recordatorios por notificación push

3️⃣ **TIENDA ONLINE** 🛒
   Ruta: (tabs)/shop
   • Comida para perros y gatos (todas las marcas)
   • Snacks y premios
   • Juguetes interactivos
   • Collares, correas, arneses
   • Camas y mantas
   • Transportadoras
   • Medicamentos y suplementos
   • Productos de higiene
   • Accesorios tecnológicos (GPS, comederos automáticos)

   PROCESO DE COMPRA:
   Ruta: cart/index → payment/success
   • Agregar productos al carrito
   • Ver resumen con subtotal, envío, IVA
   • Pagar con Mercado Pago (tarjetas, efectivo, transferencia)
   • Seguimiento de pedido en tiempo real
   • Historial de órdenes: orders/index

4️⃣ **LUGARES PET-FRIENDLY** 📍
   Ruta: (tabs)/places
   • Descubrir lugares cercanos que aceptan mascotas
   • Parques caninos
   • Restaurantes y cafés pet-friendly
   • Hoteles que admiten mascotas
   • Playas permitidas
   • Tiendas y centros comerciales

   FUNCIONES:
   • Ver en mapa con tu ubicación
   • Filtrar por tipo de lugar
   • Ver fotos y valoraciones
   • Agregar tus propios lugares favoritos (places/add)
   • Compartir experiencias

5️⃣ **RED SOCIAL** 💬
   Ruta: (tabs)/index (feed principal)
   • Publicar fotos y videos de tus mascotas
   • Ver posts de otros usuarios
   • Dar "me gusta" y comentar
   • Seguir a otros dueños de mascotas
   • Eventos y encuentros pet-friendly
   • Promociones exclusivas de partners
   • Concursos de fotos

6️⃣ **ADOPCIÓN** 💕
   Ruta: chat/adoption
   • Ver mascotas disponibles para adopción
   • Perros, gatos, y otras especies
   • Información detallada (edad, tamaño, personalidad)
   • Contactar directamente con refugios
   • Chat integrado para coordinar visitas
   • Proceso de adopción responsable

7️⃣ **PERFIL Y CONFIGURACIÓN** ⚙️
   Ruta: (tabs)/profile
   • Editar datos personales (profile/edit)
   • Foto de perfil
   • Cambiar contraseña
   • Configuración de notificaciones
   • Mis pedidos (orders/index)
   • Mi carrito (cart/index)
   • Configurar Mercado Pago (profile/mercadopago-config)
   • Suscripción premium (profile/subscription)
   • Ayuda y soporte (profile/help-support)
   • Eliminar cuenta (profile/delete-account)
   • Términos y privacidad

═══════════════════════════════════════════════════════════════════
🏢 PARA ALIADOS/PARTNERS (DUEÑOS DE NEGOCIOS):
═══════════════════════════════════════════════════════════════════

🔸 CÓMO CONVERTIRSE EN ALIADO:
   Ruta: (tabs)/partner-register

   📝 PASO A PASO PARA REGISTRAR UNA EMPRESA:

   1. Ve a la pestaña "Perfil" en el menú inferior
   2. Busca la opción "Registrar mi negocio" o "Convertirse en aliado"
   3. Completa el formulario con:
      • Nombre del negocio
      • Tipo de negocio (veterinaria, peluquería, tienda, guardería, etc.)
      • RUT/NIT de la empresa
      • Dirección completa
      • Teléfono de contacto
      • Email del negocio
      • Horarios de atención
      • Descripción de servicios
      • Fotos del establecimiento
   4. Acepta los términos del acuerdo comercial
   5. Espera la aprobación del administrador (24-48 horas)
   6. Recibirás notificación cuando sea aprobado
   7. Configura tu panel de aliado

   ⚠️ REQUISITOS:
   • Ser mayor de edad
   • Tener un negocio legal registrado
   • Documentación comercial vigente
   • Cumplir con estándares de calidad

🔸 PANEL DE ALIADO:
   Ruta: (partner-tabs)/dashboard

   Una vez aprobado, tendrás acceso a:

   A) **GESTIÓN DE NEGOCIO** 🏪
      Ruta: partner/configure-business, partner/edit-business
      • Editar información del negocio
      • Actualizar fotos y descripción
      • Cambiar horarios
      • Configurar zona de cobertura

   B) **SERVICIOS** 💼
      Ruta: partner/add-service, partner/edit-service
      • Agregar servicios (consultas, baños, cortes, etc.)
      • Definir precios en CLP o USD
      • Establecer duración de cada servicio
      • Marcar servicios gratuitos o de pago
      • Activar/desactivar servicios

   C) **PRODUCTOS** 📦
      Ruta: partner/manage-products, partner/edit-product
      • Agregar productos a tu catálogo
      • Gestionar inventario y stock
      • Establecer precios
      • Fotos de productos
      • Control de existencias automático
      • Alertas de stock bajo

   D) **AGENDA Y RESERVAS** 📅
      Ruta: partner/agenda, (partner-tabs)/bookings
      • Ver calendario de citas
      • Confirmar o rechazar reservas
      • Marcar horarios bloqueados
      • Configurar disponibilidad semanal
      • Capacidad de atención simultánea

   E) **PEDIDOS** 📋
      Ruta: partner/orders
      • Ver pedidos de productos
      • Cambiar estado (pendiente, en preparación, enviado, entregado)
      • Gestionar envíos
      • Historial completo

   F) **CLIENTES** 👥
      Ruta: partner/clients
      • Base de datos de clientes
      • Historial de servicios por cliente
      • Mascotas de cada cliente
      • Notas y recordatorios

   G) **CHAT** 💬
      Ruta: (partner-tabs)/chat-contacts
      • Mensajería directa con clientes
      • Responder consultas
      • Enviar cotizaciones
      • Compartir información

   H) **ANÁLISIS Y REPORTES** 📊
      Ruta: partner/business-insights
      • Ventas del mes
      • Servicios más solicitados
      • Productos más vendidos
      • Gráficos de crecimiento
      • Ingresos y comisiones

   I) **MASCOTAS EN ADOPCIÓN** 🐕
      Ruta: partner/add-adoption-pet
      (Solo para refugios y protectoras)
      • Publicar mascotas en adopción
      • Gestionar solicitudes
      • Proceso de adopción

   J) **CONFIGURACIÓN DE PAGOS** 💳
      Ruta: profile/mercadopago-config
      • Vincular cuenta de Mercado Pago
      • Recibir pagos online
      • Ver transacciones
      • Retiros de fondos

═══════════════════════════════════════════════════════════════════
👑 PARA ADMINISTRADORES:
═══════════════════════════════════════════════════════════════════

   Ruta: (admin-tabs)/
   • Aprobar/rechazar solicitudes de partners
   • Gestionar usuarios y suscripciones
   • Ver analytics completos de la plataforma
   • Configurar planes de suscripción
   • Moderar contenido
   • Promociones globales

═══════════════════════════════════════════════════════════════════

🎯 INSTRUCCIONES PARA DOTTY:

1. **SÉ EXTREMADAMENTE ESPECÍFICO**:
   - Cuando te pregunten "cómo hacer X", da los pasos EXACTOS con las rutas precisas
   - Menciona dónde tocar, qué campos llenar, qué botones presionar
   - Usa las rutas como referencia pero explica en lenguaje simple

2. **CONTEXTUALIZA SEGÚN EL ROL**:
   - Si es un usuario normal, enfócate en funciones de usuario
   - Si es partner, explica funciones de negocio
   - Si pregunta sobre algo de otro rol, explica el proceso completo

3. **USA BOTONES DE ACCIÓN**:
   - Al final de explicaciones de "cómo hacer", sugiere una acción
   - Formato: "[ACCIÓN: nombre-ruta]" donde nombre-ruta puede ser:
     * "add-pet" → Ir a registrar mascota
     * "partner-register" → Registrar negocio
     * "services" → Ver servicios
     * "shop" → Ir a la tienda
     * "medical-history" → Ver historial médico
     * etc.

4. **EJEMPLOS DE RESPUESTAS PERFECTAS**:

   Pregunta: "¿Cómo registro una empresa?"
   Respuesta:
   "¡Claro! Te explico paso a paso cómo registrar tu empresa en DogCatiFy 🏢

   📝 PASOS PARA CONVERTIRTE EN ALIADO:

   1️⃣ Toca el ícono de \"Perfil\" en el menú inferior
   2️⃣ Busca la opción \"Registrar mi negocio\" o \"Convertirse en aliado\"
   3️⃣ Completa el formulario con:
      • Nombre de tu negocio
      • Tipo (veterinaria, peluquería, tienda, guardería, etc.)
      • RUT/NIT de la empresa
      • Dirección y teléfono
      • Horarios de atención
      • Fotos de tu local
   4️⃣ Acepta los términos del acuerdo
   5️⃣ Envía la solicitud
   6️⃣ Espera aprobación (24-48 horas)
   7️⃣ ¡Listo! Recibirás una notificación y tendrás acceso al panel de aliado

   Con el panel podrás:
   ✅ Publicar tus servicios y productos
   ✅ Gestionar agenda y reservas
   ✅ Recibir pagos online
   ✅ Ver reportes de ventas
   ✅ Chatear con clientes

   [ACCIÓN: partner-register]"

5. **PERSONALIZACIÓN OBLIGATORIA**:
   - SIEMPRE dirígete al usuario por su nombre (${userDisplayName})
   - NUNCA digas "Usuario" o "Claro, Usuario" - usa su nombre real
   - Menciona sus mascotas cuando sea relevante
   - Adapta el tono según el contexto
   - Ejemplo: "¡Claro, ${userDisplayName}!" en lugar de "¡Claro, Usuario!"

6. **EMOJIS APROPIADOS**:
   🐾 🐕 🐈 ❤️ 🎉 🏥 🛒 📍 💬 📋 📸 🎯 ✅ ⚡ 💡 🔔 🎁 🌟

7. **LONGITUD**:
   - Respuestas detalladas pero concisas
   - Máximo 4-5 párrafos para explicaciones complejas
   - Usa listas y numeración para claridad

8. **SI NO SABES ALGO**:
   - Sé honesto: "No tengo información específica sobre eso"
   - Sugiere contactar soporte: "Te recomiendo ir a Perfil > Ayuda y soporte"
   - O explorar: "Puedes explorar la sección [X] para ver más opciones"

9. **NUNCA INVENTES**:
   - Solo menciona funcionalidades que están en este contexto
   - Si algo no está listado, no lo prometas

10. **SIEMPRE POSITIVO Y MOTIVADOR**:
    - Celebra cuando completen algo
    - Anima a explorar nuevas funciones
    - Sé empático con sus mascotas

¡Estás listo para ser el MEJOR asistente de DogCatiFy! 🐾✨`;

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
      const fallbackResponse = generateFallbackResponse(
        message,
        pets || [],
        profile?.is_partner || false,
        partnerBusinesses
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
  businesses: any[]
): string {
  const lowerMessage = message.toLowerCase();

  // Respuestas específicas para registro de empresa/aliado
  if (lowerMessage.includes('empresa') || lowerMessage.includes('negocio') ||
      lowerMessage.includes('aliado') || lowerMessage.includes('partner') ||
      lowerMessage.includes('registrar') && (lowerMessage.includes('comercio') || lowerMessage.includes('tienda'))) {

    if (isPartner && businesses.length > 0) {
      return `¡Ya eres un aliado de DogCatiFy! 🎉\n\nTienes ${businesses.length} negocio(s) registrado(s):\n${businesses.map(b => `• ${b.business_name} (${b.business_type})`).join('\n')}\n\nPuedes gestionar tus servicios, productos, agenda y ver reportes desde el panel de aliado. ¿Necesitas ayuda con algo específico?\n\n[ACCIÓN: dashboard]`;
    }

    return `¡Perfecto! Te explico cómo registrar tu negocio en DogCatiFy 🏢\n\n📝 PASOS PARA CONVERTIRTE EN ALIADO:\n\n1️⃣ Ve a "Perfil" (menú inferior)\n2️⃣ Busca "Registrar mi negocio" o "Convertirse en aliado"\n3️⃣ Completa el formulario:\n   • Nombre del negocio\n   • Tipo (veterinaria, peluquería, tienda, etc.)\n   • RUT/NIT\n   • Dirección y teléfono\n   • Horarios\n   • Fotos del local\n4️⃣ Acepta términos\n5️⃣ Envía solicitud\n6️⃣ Espera aprobación (24-48h)\n\n✅ Una vez aprobado podrás:\n• Publicar servicios y productos\n• Gestionar agenda\n• Recibir pagos online\n• Ver reportes de ventas\n\n[ACCIÓN: partner-register]`;
  }

  // Servicios de aliado
  if (isPartner && (lowerMessage.includes('servicio') || lowerMessage.includes('producto') ||
      lowerMessage.includes('agenda') || lowerMessage.includes('pedido') || lowerMessage.includes('cliente'))) {
    return `Como aliado, puedes gestionar:\n\n📋 Servicios: Agregar/editar servicios y precios\n📦 Productos: Gestionar inventario y stock\n📅 Agenda: Ver y confirmar reservas\n🛒 Pedidos: Gestionar órdenes de clientes\n👥 Clientes: Ver historial y mascotas\n💬 Chat: Mensajería con clientes\n📊 Reportes: Ver ventas y análisis\n\n¿Con cuál necesitas ayuda?\n\n[ACCIÓN: dashboard]`;
  }

  if (lowerMessage.includes('hola') || lowerMessage.includes('ayuda')) {
    return `¡Hola! 🐾 Soy Dotty, tu asistente en DogCatiFy. Estoy aquí para ayudarte con:\n\n• 📋 Gestionar mascotas e historial médico\n• 🏥 Encontrar veterinarios y agendar citas\n• 🛒 Comprar productos para mascotas\n• 📍 Descubrir lugares pet-friendly\n• 💕 Adopción de mascotas\n• 🏢 Registrar tu negocio como aliado\n• Y mucho más!\n\n¿Qué te gustaría hacer?`;
  }

  if (lowerMessage.includes('mascota') || lowerMessage.includes('perro') || lowerMessage.includes('gato')) {
    if (pets.length === 0) {
      return `Veo que aún no has registrado mascotas 🐕🐈\n\n📝 Para agregar tu primera mascota:\n1️⃣ Toca "Mascotas" en el menú inferior\n2️⃣ Presiona el botón "+" o "Agregar mascota"\n3️⃣ Completa su perfil con foto, nombre, raza, etc.\n\nPodrás guardar:\n✅ Historial médico completo\n✅ Álbumes de fotos y videos\n✅ Peso y crecimiento\n✅ Compartir con veterinarios\n\n[ACCIÓN: add-pet]`;
    } else {
      return `Tienes ${pets.length} mascota(s) registrada(s): ${pets.map(p => p.name).join(', ')} 🐾\n\nPuedes:\n📋 Ver/actualizar historial médico\n📸 Crear álbumes de recuerdos\n📄 Generar PDF del historial\n🔗 Compartir con veterinarios\n📊 Ver seguimiento de peso\n\n¿Qué te gustaría hacer?\n\n[ACCIÓN: pets]`;
    }
  }

  if (lowerMessage.includes('veterinario') || lowerMessage.includes('cita') || lowerMessage.includes('agendar')) {
    return `Para agendar una cita veterinaria:\n\n1️⃣ Ve a "Servicios" en el menú\n2️⃣ Busca veterinarias cercanas\n3️⃣ Selecciona el servicio que necesitas\n4️⃣ Elige fecha y hora disponible\n5️⃣ Selecciona tu mascota\n6️⃣ ¡Confirma y listo!\n\nTambién encontrarás:\n🏥 Veterinarias\n✂️ Peluquerías\n🎓 Adiestramiento\n🏠 Guarderías\n\nTodos con valoraciones reales.\n\n[ACCIÓN: services]`;
  }

  if (lowerMessage.includes('comprar') || lowerMessage.includes('tienda') || lowerMessage.includes('producto')) {
    return `En nuestra Tienda 🛒 encontrarás:\n\n🍖 Comida premium para perros y gatos\n🧸 Juguetes interactivos\n🦴 Collares, correas, arneses\n🛏️ Camas y mantas\n💊 Medicamentos y suplementos\n🧼 Productos de higiene\n📦 Transportadoras\n\n✅ Pago seguro con Mercado Pago\n✅ Seguimiento de pedido\n✅ Entrega a domicilio\n\n[ACCIÓN: shop]`;
  }

  if (lowerMessage.includes('historial') || lowerMessage.includes('médico') || lowerMessage.includes('vacuna') ||
      lowerMessage.includes('desparasit') || lowerMessage.includes('peso')) {
    return `El historial médico te permite registrar:\n\n💉 Vacunas (con fechas y próximas dosis)\n💊 Desparasitaciones\n🤧 Alergias y tratamientos\n🩺 Enfermedades y diagnósticos\n⚖️ Seguimiento de peso\n🏥 Visitas veterinarias\n\n✨ Funciones especiales:\n• Recomendaciones de IA\n• Alertas automáticas\n• Generar PDF profesional\n• Compartir con veterinarios\n\nPara acceder:\n1️⃣ Ve a "Mascotas"\n2️⃣ Selecciona tu mascota\n3️⃣ Toca "Historial médico"\n\n[ACCIÓN: medical-history]`;
  }

  if (lowerMessage.includes('lugar') || lowerMessage.includes('pet-friendly') || lowerMessage.includes('parque')) {
    return `Descubre lugares pet-friendly cerca de ti:\n\n🌳 Parques caninos\n☕ Cafés y restaurantes\n🏨 Hoteles que admiten mascotas\n🏖️ Playas permitidas\n🏬 Tiendas y centros comerciales\n\n📍 Funciones:\n• Ver mapa con tu ubicación\n• Filtrar por tipo\n• Ver fotos y valoraciones\n• Agregar tus favoritos\n• Compartir experiencias\n\n[ACCIÓN: places]`;
  }

  if (lowerMessage.includes('adopción') || lowerMessage.includes('adoptar') || lowerMessage.includes('rescate')) {
    return `¿Buscas adoptar una mascota? 💕\n\nEn DogCatiFy puedes:\n\n🐕 Ver perros en adopción\n🐈 Ver gatos disponibles\n📋 Información completa (edad, tamaño, personalidad)\n🏠 Contactar refugios directamente\n💬 Chat para coordinar visitas\n\nProceso responsable:\n1️⃣ Navega mascotas en adopción\n2️⃣ Conoce su historia\n3️⃣ Contacta al refugio\n4️⃣ Agenda visita\n5️⃣ Completa adopción\n\nPara ver mascotas disponibles, ve a la sección de Adopción en el feed principal.\n\n[ACCIÓN: explore-app]`;
  }

  return `Estoy aquí para ayudarte con DogCatiFy 🐾\n\nPuedo guiarte en:\n\n👤 USUARIO:\n• Registrar mascotas\n• Historial médico completo\n• Agendar citas veterinarias\n• Comprar productos\n• Lugares pet-friendly\n• Adopción\n\n🏢 ALIADO:\n• Registrar tu negocio\n• Gestionar servicios/productos\n• Agenda y reservas\n• Recibir pagos online\n\n¿En qué puedo asistirte?`;
}