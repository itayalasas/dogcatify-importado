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
    id: 'care-hub',
    title: 'Cuidado inteligente',
    keywords: [
      'cuidado inteligente',
      'modo emergencia',
      'emergencia mascota',
      'recomendaciones personalizadas',
      'alertas medicas',
      'alertas médicas',
      'salud preventiva',
      'cuidado de mascota',
    ],
    answer:
      'Para ver recomendaciones personalizadas y el modo emergencia de tu mascota:\n' +
      '1) Abre la mascota en la pestaña "Mascotas".\n' +
      '2) Entra en "Cuidado inteligente".\n' +
      '3) Revisa vacunas, alertas, peso y conducta.\n' +
      '4) Usa el acceso rápido para compartir la historia clínica o abrir la ficha de emergencia.',
    action: 'care-hub',
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
    id: 'ally-crm',
    title: 'Clientes y retención',
    keywords: [
      'clientes',
      'crm',
      'retencion',
      'retención',
      'fidelizacion',
      'fidelización',
      'reactivar clientes',
      'seguimiento de clientes',
      'clientes aliado',
      'clientes partner',
      'seguimiento negocio',
    ],
    answer:
      'Para trabajar tu CRM y retención:\n' +
      '1) Entra a tu Dashboard de aliado.\n' +
      '2) Abre la sección "Ver Clientes".\n' +
      '3) Revisa el último contacto, interacciones y datos de contacto.\n' +
      '4) Usa la lista para reactivar clientes y dar seguimiento más rápido.',
    action: 'partner-clients',
  },
  {
    id: 'ally-bookings',
    title: 'Reservas de aliado',
    keywords: [
      'reservas aliado',
      'agenda aliado',
      'reservas de hoy',
      'ver reservas',
      'agenda negocio',
      'turnos del negocio',
      'bookings negocio',
    ],
    answer:
      'Para revisar tus reservas como aliado:\n' +
      '1) Ve al dashboard del negocio.\n' +
      '2) Abre la sección "Reservas".\n' +
      '3) Revisa pendientes, confirmadas y completadas.\n' +
      '4) Usa la agenda para seguir cada turno y su estado.',
    action: 'partner-bookings',
  },
  {
    id: 'ally-adoptions',
    title: 'Adopciones de aliado',
    keywords: [
      'adopciones',
      'mascota en adopcion',
      'mascota en adopción',
      'publicar mascota en adopcion',
      'publicar mascota en adopción',
      'gestionar adopciones',
      'adoption pets',
    ],
    answer:
      'Para gestionar adopciones como aliado:\n' +
      '1) Abre tu negocio y entra a la sección de adopciones.\n' +
      '2) Crea o edita una publicación.\n' +
      '3) Revisa disponibilidad, requisitos y descripción.\n' +
      '4) Guarda cambios para mantener el catálogo al día.',
    action: 'partner-adoptions',
  },
  {
    id: 'ally-plan',
    title: 'Plan y permisos',
    keywords: [
      'plan actual',
      'que puedo hacer o no',
      'qué puedo hacer o no',
      'modulos habilitados',
      'módulos habilitados',
      'permisos',
      'suscripcion',
      'suscripción',
      'plan pro',
    ],
    answer:
      'Para revisar lo que tu plan permite:\n' +
      '1) Entra al dashboard o selector de negocio.\n' +
      '2) Revisa los módulos visibles y los bloqueados.\n' +
      '3) Identifica qué acciones están habilitadas para tu suscripción.\n' +
      '4) Si necesitas ampliar acceso, revisa la opción de actualización de plan.',
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
    pattern: /(clientes|crm|retencion|retención|fideliz|reactivar|seguimiento).*(aliad|partner|negocio)|reactivar clientes|seguimiento de clientes/,
    knowledgeId: 'ally-crm',
  },
  {
    pattern: /(reservas|agenda|turnos).*(aliad|partner|negocio)|reservas de hoy|ver reservas|agenda negocio/,
    knowledgeId: 'ally-bookings',
  },
  {
    pattern: /(adopcion|adopción|adopciones|publicar mascota en adopcion|publicar mascota en adopción|gestionar adopciones)/,
    knowledgeId: 'ally-adoptions',
  },
  {
    pattern: /(plan actual|que puedo hacer o no|qué puedo hacer o no|modulos habilitados|módulos habilitados|permisos|suscripcion|suscripción|plan pro)/,
    knowledgeId: 'ally-plan',
  },
  {
    pattern: /(cuidado inteligente|modo emergencia|emergencia mascota|recomendaciones personalizadas|alertas medicas|alertas médicas|salud preventiva|cuidado de mascota)/,
    knowledgeId: 'care-hub',
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

function greet(name: string): string {
  return name ? `¡Hola, ${name}!` : '¡Hola!';
}

function formatKnowledgeReply(
  userName: string,
  entry: KnowledgeEntry,
  alreadyHasPets: boolean,
  petNames: string[],
  isBusinessSession: boolean
): string {
  const hello = greet(userName);
  const personalizedIntro = isBusinessSession
    ? `${hello}\n\n`
    : alreadyHasPets
      ? `${hello} Te cuento sobre esto pensando en ${petNames.join(', ')}.\n\n`
      : `${hello}\n\n`;

  const actionLine = entry.action ? `\n\n[ACCIÓN: ${entry.action}]` : '';
  return `${personalizedIntro}${entry.answer}${actionLine}`;
}

function getSpeciesLabel(species?: string | null): string {
  if (!species) return 'mascota';
  const normalized = normalizeText(species);
  if (normalized.includes('dog')) return 'perro';
  if (normalized.includes('cat')) return 'gato';
  return species;
}

function formatAssistantDate(dateString?: string | null): string {
  if (!dateString) return 'sin fecha';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'sin fecha';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'hoy';
  if (diffDays === 1) return 'mañana';
  if (diffDays > 1 && diffDays <= 7) return `en ${diffDays} días`;
  if (diffDays < 0 && diffDays >= -7) return `hace ${Math.abs(diffDays)} días`;

  return date.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildPetLookup(pets: any[] = []): Map<string, any> {
  return new Map((pets || []).filter(Boolean).map((pet: any) => [pet.id, pet]));
}

function summarizePets(pets: any[] = []): string {
  if (!pets || pets.length === 0) {
    return 'No hay mascotas registradas todavía.';
  }

  return pets
    .slice(0, 5)
    .map((pet: any) => {
      const species = getSpeciesLabel(pet.species);
      const breed = pet.breed ? `, ${pet.breed}` : '';
      const weight = pet.weight ? `, ${pet.weight}${pet.weight_unit || 'kg'}` : '';
      return `- ${pet.name || 'Mascota'}: ${species}${breed}${weight}`;
    })
    .join('\n');
}

function summarizeAlerts(alerts: any[] = [], petLookup: Map<string, any>): string {
  if (!alerts || alerts.length === 0) {
    return 'No hay alertas médicas pendientes.';
  }

  return alerts
    .slice(0, 5)
    .map((alert: any) => {
      const petName = petLookup.get(alert.pet_id)?.name || alert.pets?.name || 'Mascota';
      const priority = alert.priority ? `prioridad ${alert.priority}` : 'prioridad normal';
      const due = formatAssistantDate(alert.due_date);
      const detail = alert.description ? ` - ${alert.description}` : '';
      return `- ${petName}: ${alert.title || 'Alerta'} (${due}, ${priority})${detail}`;
    })
    .join('\n');
}

function summarizeBookings(bookings: any[] = []): string {
  if (!bookings || bookings.length === 0) {
    return 'No hay reservas próximas.';
  }

  return bookings
    .slice(0, 4)
    .map((booking: any) => {
      const date = formatAssistantDate(booking.date);
      const time = booking.time ? ` a las ${booking.time}` : '';
      const partner = booking.partner_name ? ` con ${booking.partner_name}` : '';
      const status = booking.status ? ` (${booking.status})` : '';
      return `- ${booking.service_name || 'Servicio'}${partner} para ${booking.pet_name || 'tu mascota'} ${date}${time}${status}`;
    })
    .join('\n');
}

const HEALTH_TYPE_LABELS: Record<string, string> = {
  vaccine: 'vacuna',
  deworming: 'desparasitación',
  illness: 'enfermedad',
  allergy: 'alergia',
  weight: 'peso',
};

function summarizeHealthRecords(records: any[] = [], petLookup: Map<string, any>): string {
  if (!records || records.length === 0) {
    return 'No hay registros de salud recientes.';
  }

  return records
    .slice(0, 10)
    .map((record: any) => {
      const petName = petLookup.get(record.pet_id)?.name || 'Mascota';
      const type = HEALTH_TYPE_LABELS[record.type] || record.type || 'registro';
      if (record.type === 'weight' && record.weight) {
        const when = record.date ? ` (${record.date})` : '';
        return `- ${petName}: peso ${record.weight}${record.weight_unit || 'kg'}${when}`;
      }
      const recordName = record.name || record.product_name || '';
      const applied = record.application_date || record.diagnosis_date;
      const appliedText = applied ? `, registrado ${applied}` : '';
      const nextText = record.next_due_date ? `, próxima dosis ${record.next_due_date}` : '';
      const detail = record.severity ? `, severidad ${record.severity}` : '';
      const status = record.status ? `, estado ${record.status}` : '';
      return `- ${petName}: ${type}${recordName ? ` ${recordName}` : ''}${appliedText}${nextText}${detail}${status}`;
    })
    .join('\n');
}

function summarizeBehaviors(records: any[] = [], petLookup: Map<string, any>): string {
  if (!records || records.length === 0) {
    return 'No hay evaluaciones de conducta recientes.';
  }

  return records
    .slice(0, 3)
    .map((record: any) => {
      const petName = petLookup.get(record.pet_id)?.name || 'Mascota';
      const traits = Array.isArray(record.traits) && record.traits.length > 0
        ? record.traits.slice(0, 3).map((trait: any) => trait.name || trait.label || String(trait)).join(', ')
        : 'sin rasgos destacados';
      return `- ${petName}: ${traits}`;
    })
    .join('\n');
}

function buildCareAssistantContext({
  pets,
  alerts,
  bookings,
  healthRecords,
  behaviorRecords,
}: {
  pets: any[];
  alerts: any[];
  bookings: any[];
  healthRecords: any[];
  behaviorRecords: any[];
}): string {
  const petLookup = buildPetLookup(pets);

  return [
    'CONTEXTO REAL DE LA APP:',
    `Mascotas registradas:\n${summarizePets(pets)}`,
    `Alertas médicas próximas:\n${summarizeAlerts(alerts, petLookup)}`,
    `Reservas próximas:\n${summarizeBookings(bookings)}`,
    `Registros de salud recientes:\n${summarizeHealthRecords(healthRecords, petLookup)}`,
    `Conducta reciente:\n${summarizeBehaviors(behaviorRecords, petLookup)}`,
  ].join('\n\n');
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

    const { message, conversationHistory, userId, userName, activeRole } = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // El userId viene del cliente: confirmamos que coincide con el usuario del token
    // para que nadie pueda leer los datos de otra persona.
    const accessToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: authData } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : { data: { user: null } };
    if (!authData?.user || authData.user.id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email, is_partner, is_admin, onboarding_completed')
      .eq('id', userId)
      .single();

    const metadata = authData.user.user_metadata || {};
    const fullName = [
      userName && userName !== 'Usuario' ? userName : '',
      profile?.display_name,
      metadata.full_name,
      metadata.name,
    ].find((value) => typeof value === 'string' && value.trim().length > 0) || '';
    // Solo el primer nombre: suena más cercano ("¡Hola, Pedro!").
    const userDisplayName = fullName.trim().split(/\s+/)[0] || '';

    const [ownedPetsResponse, sharedPetsResponse] = await Promise.all([
      supabase
        .from('pets')
        .select('id, name, species, breed, weight, weight_unit, age, age_unit, gender, owner_id, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('pet_shares')
        .select(`
          pet_id,
          permission_level,
          pets!inner (
            id,
            name,
            species,
            breed,
            weight,
            weight_unit,
            age,
            age_unit,
            gender,
            owner_id,
            created_at
          )
        `)
        .eq('shared_with_user_id', userId)
        .eq('status', 'accepted')
    ]);

    let partnerBusinesses = [];
    if (profile?.is_partner) {
      const { data: businesses } = await supabase
        .from('partners')
        .select('business_name, business_type, status')
        .eq('user_id', userId);
      partnerBusinesses = businesses || [];
    }

    const ownedPets = ownedPetsResponse.data || [];
    const sharedPets = (sharedPetsResponse.data || [])
      .map((share: any) => {
        const pet = Array.isArray(share?.pets) ? share.pets[0] : share?.pets;
        if (!pet) return null;
        return {
          ...pet,
          is_shared: true,
          permission_level: share.permission_level,
        };
      })
      .filter(Boolean);

    const petById = new Map<string, any>();
    [...ownedPets, ...sharedPets].forEach((pet: any) => {
      if (pet?.id && !petById.has(pet.id)) {
        petById.set(pet.id, pet);
      }
    });

    const petList = Array.from(petById.values());
    const petIds = petList.map((pet: any) => pet.id).filter(Boolean);
    const upcomingDateLimit = new Date();
    upcomingDateLimit.setDate(upcomingDateLimit.getDate() + 14);

    let medicalAlerts: any[] = [];
    let upcomingBookings: any[] = [];
    let healthRecords: any[] = [];
    let behaviorRecords: any[] = [];

    const [bookingsResponse, alertsResponse, healthResponse, behaviorResponse] = await Promise.all([
      supabase
        .from('bookings')
        .select('service_name, pet_name, date, time, status, partner_name')
        .eq('customer_id', userId)
        .in('status', ['pending', 'pending_payment', 'confirmed'])
        .gte('date', new Date().toISOString())
        .lte('date', upcomingDateLimit.toISOString())
        .order('date', { ascending: true })
        .limit(4),
      petIds.length > 0
        ? supabase
            .from('medical_alerts')
            .select('id, pet_id, alert_type, title, description, due_date, priority, status')
            .in('pet_id', petIds)
            .eq('status', 'pending')
            .order('due_date', { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      petIds.length > 0
        ? supabase
            .from('pet_health')
            .select('id, pet_id, type, name, product_name, severity, status, application_date, diagnosis_date, next_due_date, weight, weight_unit, date, created_at')
            .in('pet_id', petIds)
            .order('created_at', { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null }),
      petIds.length > 0
        ? supabase
            .from('pet_behavior')
            .select('id, pet_id, traits, assessment_date')
            .in('pet_id', petIds)
            .order('assessment_date', { ascending: false })
            .limit(3)
        : Promise.resolve({ data: [], error: null }),
    ]);

    upcomingBookings = bookingsResponse.data || [];
    medicalAlerts = alertsResponse.data || [];
    healthRecords = healthResponse.data || [];
    behaviorRecords = behaviorResponse.data || [];

    const effectiveRole = activeRole === 'admin' || activeRole === 'partner' || activeRole === 'owner'
      ? activeRole
      : (profile?.is_admin ? 'admin' : (profile?.is_partner ? 'partner' : 'owner'));
    const isBusinessSession = effectiveRole === 'partner' || effectiveRole === 'admin';
    const userRole = effectiveRole === 'admin'
      ? 'Administrador'
      : effectiveRole === 'partner'
        ? 'Aliado/Partner'
        : 'Usuario';
    const businessInfo = partnerBusinesses.length > 0
      ? `\nNegocios registrados: ${partnerBusinesses.map(b => `${b.business_name} (${b.business_type} - ${b.status})`).join(', ')}`
      : '';
    const roleContextLine = isBusinessSession
      ? 'Modo negocio activo: prioriza clientes, retención, reservas, pedidos, adopciones, métricas y permisos. No uses datos de mascotas personales salvo que el usuario cambie explícitamente a modo usuario.'
      : `Mascotas accesibles: ${petList && petList.length > 0 ? petList.map(p => `${p.name} (${p.species} - ${p.breed})`).join(', ') : 'Ninguna mascota registrada'}`;

    const nameLine = userDisplayName
      ? `Se llama ${userDisplayName}. Hablale por su nombre de vez en cuando, como lo haría alguien que lo conoce (no en cada mensaje). Nunca le digas "usuario".`
      : 'No sabemos su nombre: no lo llames "usuario"; hablale de "vos" directamente.';

    const ownerSystemContext = `Sos Dotty, la asistente de DogCatiFy que ayuda a las personas cuando su mascota tiene un problema o les genera una duda, y las orienta sobre qué hacer.

CON QUIÉN HABLÁS:
${nameLine}
${roleContextLine}

TU TAREA PRINCIPAL ES ORIENTAR:
1. Entendé el problema: qué le pasa, a cuál mascota, desde cuándo y cómo está (come, toma agua, tiene energía). Si falta un dato clave, hacé una sola pregunta por vez.
2. Evaluá la urgencia y decila claro, en una de tres:
   - "Urgente": dificultad para respirar, convulsiones, desmayo, sangrado abundante, posible intoxicación, abdomen hinchado y duro, no puede orinar, vómitos o diarrea con sangre, golpe fuerte. Decile que vaya a una veterinaria ya, antes que cualquier otra cosa.
   - "Consultá pronto": síntomas que siguen más de 24 a 48 horas, no come, dolor, cojera, picazón fuerte, cambios de conducta.
   - "Podés manejarlo en casa": dudas de rutina, alimentación, higiene, conducta leve. Dale pasos concretos y qué vigilar.
3. Decí qué profesional conviene (veterinario, peluquería, adiestrador, paseador) y ofrecé buscar o reservar un turno.
4. Usá los datos reales del CONTEXTO: nombre, especie, edad y peso de la mascota, vacunas y desparasitaciones con sus fechas, alertas y turnos. Si algo está vencido o vence pronto y viene al caso, mencionalo.
5. No diagnostiques con certeza ni indiques medicamentos o dosis. Podés explicar causas posibles y cuidados seguros.
6. Si tiene varias mascotas y no queda claro de cuál habla, preguntá cuál.
7. Si pregunta cómo usar la app, respondé con pasos cortos y reales, y volvé a ofrecer ayuda con su mascota. Para agregar una mascota: Mascotas, botón "+", foto, datos y Guardar.${petList && petList.length > 0 ? ` Ya tiene a ${petList.map(p => p.name).join(', ')}.` : ''}
8. Si el CONTEXTO contradice algo dicho antes en la conversación, vale el CONTEXTO. Nunca inventes funciones de la app ni datos de la mascota.

FORMATO:
- Español rioplatense, tratá de "vos". Cálida, tranquila y directa, como una amiga que sabe de mascotas.
- Respuestas cortas: 2 a 5 frases o una lista breve. Como mucho un emoji.
- Cerrá con el siguiente paso concreto o una pregunta.
- Si conviene abrir una pantalla, terminá con un solo tag: [ACCIÓN: find-vet] (buscar y reservar veterinaria u otros servicios), [ACCIÓN: medical-history] (historial, vacunas y peso), [ACCIÓN: care-hub] (cuidado inteligente y modo emergencia), [ACCIÓN: add-pet] (registrar mascota), [ACCIÓN: shop] (tienda).`;

    const businessSystemContext = `Sos Dotty, la asistente de DogCatiFy para negocios. Ayudás a ${userDisplayName || 'esta persona'} (${userRole}) a gestionar su negocio. Nunca le digas "usuario".${businessInfo}

CÓMO TRABAJÁS:
- Enfocate en clientes, retención, reservas, pedidos, adopciones, métricas y permisos del plan.
- No uses datos de mascotas personales salvo que lo pida.
- Nunca inventes funciones ni números; si no tenés el dato, decí en qué pantalla verlo.
- Español rioplatense, tratá de "vos". Respuestas cortas y concretas.
- Si conviene abrir una pantalla, terminá con un solo tag: [ACCIÓN: partner-dashboard], [ACCIÓN: partner-clients], [ACCIÓN: partner-bookings], [ACCIÓN: partner-adoptions] u [ACCIÓN: orders].`;

    const systemContext = isBusinessSession ? businessSystemContext : ownerSystemContext;

    const hasPets = petList.length > 0;
    const petNames = hasPets ? petList.map((p: any) => p.name).filter(Boolean) : [];
    const forcedKnowledgeEntry = resolveHighPriorityIntent(message);
    let knowledgeEntry = forcedKnowledgeEntry || resolveKnowledge(message);
    if (
      isBusinessSession &&
      knowledgeEntry &&
      ['pet-add', 'pet-album', 'pet-medical', 'care-hub', 'pet-share'].includes(knowledgeEntry.id)
    ) {
      knowledgeEntry = null;
    }
    const medicalQuery = isMedicalQuery(message);
    if (!isBusinessSession && medicalQuery && !forcedKnowledgeEntry) {
      // Ante un problema de salud, Dotty orienta; no responde con la guía de la app.
      knowledgeEntry = null;
    }
    const recentHistory = (conversationHistory || []).slice(-8);
    const careContext = isBusinessSession
      ? ''
      : buildCareAssistantContext({
          pets: petList,
          alerts: medicalAlerts,
          bookings: upcomingBookings,
          healthRecords,
          behaviorRecords,
        });
    const knowledgeGuidance = knowledgeEntry
      ? [
          'GUÍA FÁCTICA DE LA APP:',
          knowledgeEntry.answer,
          knowledgeEntry.action ? `Acción sugerida: [ACCIÓN: ${knowledgeEntry.action}]` : '',
          'Usa esta información como base, pero responde de forma natural y conversacional.',
        ]
          .filter(Boolean)
          .join('\n')
      : '';
    const medicalGuidance = !isBusinessSession && medicalQuery
      ? [
          'MODO SALUD:',
          'Primero descartá señales de alarma; si aparece alguna, indicá ir a una veterinaria ya.',
          'Si faltan datos, hacé una sola pregunta concreta para avanzar.',
          'Tené en cuenta especie, edad, peso y registros de salud de la mascota del CONTEXTO.',
          'Si corresponde una consulta, sugerí [ACCIÓN: find-vet].',
        ].join('\n')
      : '';

    const messages: Message[] = [
      {
        role: 'system',
        content: [
          systemContext,
          careContext,
          knowledgeGuidance,
          medicalGuidance,
          'Recordá: respuesta corta, tratá de "vos" y como mucho un tag [ACCIÓN: ...] al final.',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
      ...recentHistory,
      { role: 'user', content: message }
    ];

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      if (knowledgeEntry) {
        const deterministicReply = formatKnowledgeReply(userDisplayName, knowledgeEntry, hasPets, petNames, isBusinessSession);
        return new Response(
          JSON.stringify({ response: deterministicReply }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const fallbackResponse = generateFallbackResponse(
        message,
        petList,
        isBusinessSession,
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
        max_tokens: 450,
        temperature: 0.5,
      }),
    });

    const openaiData = await openaiResponse.json();
    let assistantMessage = openaiData?.choices?.[0]?.message?.content || '';

    if (medicalQuery && assistantMessage && !/no reemplaza/i.test(assistantMessage)) {
      assistantMessage += '\n\nEsto es una orientación y no reemplaza la consulta con tu veterinario.';
    }

    if (!assistantMessage) {
      assistantMessage = generateFallbackResponse(
        message,
        petList,
        isBusinessSession,
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
  isBusinessSession: boolean,
  businesses: any[],
  userName: string
): string {
  const lowerMessage = message.toLowerCase();
  const greeting = greet(userName);
  const isMedicalFallback = MEDICAL_AI_KEYWORDS.some((keyword) =>
    normalizeText(message).includes(normalizeText(keyword))
  );

  if (isBusinessSession) {
    if (isMedicalFallback) {
      return `${greeting} Si es una urgencia clínica, priorizá la atención profesional. En modo negocio te ayudo con clientes, reservas, pedidos, adopciones, métricas y permisos.`;
    }

    const businessSummary = businesses.length > 0
      ? `Veo ${businesses.length} negocio(s) registrados: ${businesses.map(b => b.business_name).filter(Boolean).slice(0, 3).join(', ')}.`
      : 'Puedo ayudarte con el negocio activo o a elegir uno desde el selector.';

    return `${greeting} ${businessSummary} ¿Qué querés revisar: clientes, reservas, pedidos o adopciones? [ACCIÓN: partner-dashboard]`;
  }

  if (isMedicalFallback) {
    return `${greeting} Si tu mascota tiene dificultad para respirar, convulsiones, sangrado abundante, vómitos persistentes, desmayo o un decaimiento fuerte, llevala a una veterinaria ya.\n\nSi no es urgente, te ayudo a encontrar un turno. [ACCIÓN: find-vet]`;
  }

  if (lowerMessage.includes('mascota') || lowerMessage.includes('agregar') || lowerMessage.includes('perro') || lowerMessage.includes('gato')) {
    if (pets.length > 0) {
      return `${greeting} Tenés a ${pets.map(p => p.name).join(', ')}. ¿Querés revisar sus vacunas, su peso o su historial? [ACCIÓN: medical-history]`;
    } else {
      return `${greeting} Todavía no registraste ninguna mascota. Creá su perfil y te ayudo con vacunas, controles y turnos. [ACCIÓN: add-pet]`;
    }
  }

  return `${greeting} Soy Dotty y te ayudo a cuidar a tu mascota: vacunas, peso, síntomas, alimentación y turnos. ¿Por dónde empezamos?`;
}
