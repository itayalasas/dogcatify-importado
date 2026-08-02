import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  role: Role;
  content: string;
}

interface WidgetRequest {
  message?: string;
  conversationHistory?: ChatMessage[];
  locale?: string;
}

interface WidgetResponse {
  reply: string;
  handoff: boolean;
  quickReplies: string[];
}

const QUICK_REPLIES: string[] = [
  "¿Qué servicios ofrecen?",
  "¿Cómo reservar?",
  "Horarios de atención",
  "Contacto",
];

const SUPPORT_EMAIL = "admin@dogcatify.com";
const SUPPORT_WHATSAPP = "59892519111";

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type PartnerRow = {
  id: string;
  business_name: string | null;
  business_type: string | null;
  address: string | null;
  is_active: boolean | null;
};

type ServiceRow = {
  id: string;
  partner_id: string;
  name: string | null;
  category: string | null;
  is_active: boolean | null;
};

type ScheduleRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
};

type BusinessType =
  | "veterinary"
  | "grooming"
  | "walking"
  | "boarding"
  | "shop"
  | "shelter"
  | "other";

function businessTypeLabel(type: string): string {
  switch (type) {
    case "veterinary":
      return "Veterinarias";
    case "grooming":
      return "Grooming / Peluquería";
    case "walking":
      return "Paseos";
    case "boarding":
      return "Hospedaje";
    case "shop":
      return "Tienda";
    case "shelter":
      return "Adopción / Refugios";
    default:
      return "Otros";
  }
}

function businessTypeFromMessage(message: string): BusinessType | null {
  const text = toSearchText(message);
  if (text.includes("veterin")) return "veterinary";
  if (text.includes("groom") || text.includes("peluquer") || text.includes("baño") || text.includes("bano")) return "grooming";
  if (text.includes("pase") || text.includes("walking")) return "walking";
  if (text.includes("hosped") || text.includes("pension") || text.includes("pensión") || text.includes("guarderia") || text.includes("guardería") || text.includes("boarding")) return "boarding";
  if (text.includes("tienda") || text.includes("compr") || text.includes("shop") || text.includes("producto")) return "shop";
  if (text.includes("adop") || text.includes("refug" ) || text.includes("shelter")) return "shelter";
  return null;
}

function extractLocationHint(message: string): string | null {
  const raw = message.trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Naive patterns: "en <lugar>", "cerca de <lugar>", "zona <lugar>"
  const patterns = [
    /\b(en|por|cerca de|cerca del|cerca de la|zona|barrio)\s+([\p{L}0-9\s\-]{3,40})/iu,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[2]) {
      const candidate = match[2].trim();
      // Avoid capturing trailing question-like words
      if (candidate.length >= 3) return candidate;
    }
  }
  return null;
}

function formatSchedule(rows: ScheduleRow[]): string {
  const active = rows
    .filter((r) => r && typeof r.day_of_week === "number" && r.start_time && r.end_time)
    .sort((a, b) => a.day_of_week - b.day_of_week);

  if (active.length === 0) {
    return "No encuentro un horario publicado para ese negocio todavía.";
  }

  const lines = active.map((r) => {
    const day = DAYS_ES[r.day_of_week] ?? `Día ${r.day_of_week}`;
    return `• ${day}: ${r.start_time} - ${r.end_time}`;
  });

  return lines.join("\n");
}

type CatalogHit = {
  partnerId: string;
  partnerName: string;
  businessType: string;
  address?: string;
  serviceId?: string;
  serviceName?: string;
  category?: string;
};

function buildCatalogReply(hits: CatalogHit[], intro: string): string {
  const lines = hits.slice(0, 5).map((h) => {
    const parts: string[] = [];
    parts.push(`${h.partnerName} (${businessTypeLabel(h.businessType)})`);
    if (h.serviceName) parts.push(`— ${h.serviceName}`);
    if (h.category) parts.push(`(${h.category})`);
    if (h.address) parts.push(`• ${h.address}`);
    return `• ${parts.join(" ")}`;
  });

  return (
    `${intro}\n\n` +
    lines.join("\n") +
    "\n\n¿Quieres reservar alguno? Si me dices cuál te interesa, te explico los pasos."
  );
}

async function searchCatalog(
  supabase: ReturnType<typeof createClient>,
  params: {
    query: string;
    businessType?: BusinessType | null;
    locationHint?: string | null;
    limit?: number;
  }
): Promise<CatalogHit[]> {
  const query = params.query.trim();
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 25);
  const businessType = params.businessType ?? null;
  const locationHint = params.locationHint ?? null;

  // 1) Filter partners (active). If locationHint exists, try to narrow partners first.
  let partnersQuery = supabase
    .from("partners")
    .select("id,business_name,business_type,address,is_active")
    .eq("is_active", true)
    .limit(2000);

  if (businessType) {
    partnersQuery = partnersQuery.eq("business_type", businessType);
  }

  if (locationHint) {
    const loc = locationHint.replace(/%/g, "");
    partnersQuery = partnersQuery.or(`address.ilike.%${loc}%,business_name.ilike.%${loc}%`);
  }

  const { data: partners, error: partnersError } = await partnersQuery;
  if (partnersError) throw partnersError;

  const partnerList = (partners ?? []) as PartnerRow[];
  const partnerById = new Map<string, PartnerRow>();
  for (const p of partnerList) {
    if (p?.id && p.business_name) partnerById.set(p.id, p);
  }

  // 2) Search services (active). Try match name/category by query terms.
  // Keep it simple: use ILIKE with the raw query and, if multi-word, also try first token.
  const q = query.replace(/[%,]/g, "");
  const tokens = toSearchText(q)
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 2);

  const serviceOr = [
    `name.ilike.%${q}%`,
    `category.ilike.%${q}%`,
    ...tokens.flatMap((t) => [`name.ilike.%${t}%`, `category.ilike.%${t}%`]),
  ].join(",");

  const { data: services, error: servicesError } = await supabase
    .from("partner_services")
    .select("id,partner_id,name,category,is_active")
    .eq("is_active", true)
    .or(serviceOr)
    .limit(2000);

  if (servicesError) throw servicesError;

  const serviceList = (services ?? []) as ServiceRow[];
  const hits: CatalogHit[] = [];

  for (const s of serviceList) {
    const partner = partnerById.get(s.partner_id);
    if (!partner) continue;
    if (!partner.business_name) continue;

    hits.push({
      partnerId: partner.id,
      partnerName: partner.business_name,
      businessType: (partner.business_type ?? "other"),
      address: partner.address ?? undefined,
      serviceId: s.id,
      serviceName: s.name ?? undefined,
      category: s.category ?? undefined,
    });

    if (hits.length >= limit) break;
  }

  // If no service hits, try partner name search as fallback.
  if (hits.length === 0 && q.length >= 3) {
    const { data: partnerMatches, error: partnerMatchesError } = await supabase
      .from("partners")
      .select("id,business_name,business_type,address,is_active")
      .eq("is_active", true)
      .or(`business_name.ilike.%${q}%,address.ilike.%${q}%`)
      .limit(Math.max(limit, 5));

    if (partnerMatchesError) throw partnerMatchesError;

    for (const p of (partnerMatches ?? []) as PartnerRow[]) {
      if (!p?.id || !p.business_name) continue;
      if (businessType && p.business_type !== businessType) continue;
      hits.push({
        partnerId: p.id,
        partnerName: p.business_name,
        businessType: p.business_type ?? "other",
        address: p.address ?? undefined,
      });
      if (hits.length >= limit) break;
    }
  }

  return hits;
}

type ServicesSnapshot = {
  businessTypes: string[];
  categories: string[];
  examplesByType: Record<string, string[]>;
};

let servicesSnapshotCache:
  | { expiresAt: number; value: ServicesSnapshot }
  | null = null;

async function getServicesSnapshot(supabase: ReturnType<typeof createClient>): Promise<ServicesSnapshot> {
  const now = Date.now();
  if (servicesSnapshotCache && servicesSnapshotCache.expiresAt > now) {
    return servicesSnapshotCache.value;
  }

  const { data: partners, error: partnersError } = await supabase
    .from("partners")
    .select("id,business_type,business_name,is_active")
    .eq("is_active", true)
    .limit(2000);

  if (partnersError) {
    throw partnersError;
  }

  const activePartners = ((partners ?? []) as PartnerRow[]).filter((p) => Boolean(p?.id));
  const partnerById = new Map<string, { business_type: string | null; business_name: string | null }>();
  for (const p of activePartners) {
    partnerById.set(p.id, {
      business_type: p.business_type,
      business_name: p.business_name,
    });
  }

  const { data: services, error: servicesError } = await supabase
    .from("partner_services")
    .select("id,partner_id,name,category,is_active")
    .eq("is_active", true)
    .limit(2000);

  if (servicesError) {
    throw servicesError;
  }

  const filteredServices = ((services ?? []) as ServiceRow[]).filter(
    (s) => Boolean(s?.partner_id) && partnerById.has(s.partner_id)
  );

  const businessTypesSet = new Set<string>();
  const categoriesSet = new Set<string>();
  const examplesByType: Record<string, string[]> = {};

  for (const service of filteredServices) {
    const partner = partnerById.get(service.partner_id);
    const businessType = (partner?.business_type ?? "other") as BusinessType;
    businessTypesSet.add(businessType);

    const category = typeof service.category === "string" ? service.category.trim() : "";
    if (category) categoriesSet.add(category);

    const serviceName = typeof service.name === "string" ? service.name.trim() : "";
    if (!serviceName) continue;

    if (!examplesByType[businessType]) examplesByType[businessType] = [];
    if (examplesByType[businessType].length < 3 && !examplesByType[businessType].includes(serviceName)) {
      examplesByType[businessType].push(serviceName);
    }
  }

  const snapshot: ServicesSnapshot = {
    businessTypes: Array.from(businessTypesSet).sort(),
    categories: Array.from(categoriesSet).sort(),
    examplesByType,
  };

  servicesSnapshotCache = {
    value: snapshot,
    expiresAt: now + 5 * 60 * 1000,
  };

  return snapshot;
}

function toSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

type Intent =
  | "greeting"
  | "services"
  | "booking"
  | "hours"
  | "contact"
  | "other";

function detectIntent(message: string): Intent {
  const text = toSearchText(message);

  if (!text) return "greeting";

  if (
    text.includes("hola") ||
    text.includes("buenas") ||
    text.includes("hello") ||
    text.includes("buen dia") ||
    text.includes("buenos dias") ||
    text.includes("buenas tardes") ||
    text.includes("buenas noches")
  ) {
    return "greeting";
  }

  if (
    text.includes("servicios") ||
    text.includes("que ofrecen") ||
    text.includes("que servicio") ||
    text.includes("ofrecen")
  ) {
    return "services";
  }

  if (
    text.includes("reserv") ||
    text.includes("agendar") ||
    text.includes("cita") ||
    text.includes("turno") ||
    text.includes("booking")
  ) {
    return "booking";
  }

  if (
    text.includes("horario") ||
    text.includes("atencion") ||
    text.includes("abren") ||
    text.includes("cierran")
  ) {
    return "hours";
  }

  if (
    text.includes("contact") ||
    text.includes("whatsapp") ||
    text.includes("email") ||
    text.includes("correo") ||
    text.includes("telefono")
  ) {
    return "contact";
  }

  return "other";
}

async function getFaqReply(
  intent: Intent,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  switch (intent) {
    case "greeting":
      return "¡Hola! Soy Dotty, tu asistente virtual de DogCatiFy. ¿En qué puedo ayudarte hoy?";

    case "services":
      try {
        const snapshot = await getServicesSnapshot(supabase);
        const typesLine = snapshot.businessTypes.length
          ? snapshot.businessTypes.map(businessTypeLabel).join(" · ")
          : "Servicios para mascotas";

        const examplesLines = snapshot.businessTypes
          .filter((t) => (snapshot.examplesByType[t] ?? []).length > 0)
          .slice(0, 4)
          .map((t) => {
            const examples = snapshot.examplesByType[t].slice(0, 3).join(", ");
            return `• ${businessTypeLabel(t)}: ${examples}`;
          })
          .join("\n");

        const categoriesLine = snapshot.categories.length
          ? `\n\nCategorías (según los aliados): ${snapshot.categories.slice(0, 10).join(" · ")}${snapshot.categories.length > 10 ? " · …" : ""}`
          : "";

        return (
          `Hoy en DogCatiFy puedes encontrar: ${typesLine}.\n\n` +
          (examplesLines ? `Ejemplos disponibles:\n${examplesLines}` : "") +
          categoriesLine +
          "\n\nSi me dices qué necesitas y tu zona/ciudad, te indico cómo buscarlo y reservar."
        );
      } catch (e) {
        return (
          "En DogCatiFy puedes encontrar y reservar servicios para tu mascota (según disponibilidad de cada aliado). " +
          "Si me dices qué estás buscando (veterinaria, grooming, hospedaje, paseos, etc.) y tu zona/ciudad, te guío."
        );
      }

    case "booking":
      return (
        "Para reservar un servicio en DogCatiFy:\n\n" +
        "1) Inicia sesión o crea tu cuenta\n" +
        "2) Registra al menos una mascota\n" +
        "3) Entra a ‘Servicios’ y elige el servicio\n" +
        "4) Toca ‘Reservar’, selecciona mascota, fecha y hora\n" +
        "5) Si el servicio tiene costo, completa el pago\n\n" +
        "Si me dices qué servicio buscas y tu ciudad/zona, te guío mejor."
      );

    case "hours":
      return (
        "Los horarios dependen de cada aliado/negocio y del servicio.\n\n" +
        "En la ficha del servicio verás su disponibilidad y los turnos/horarios habilitados para reservar."
      );

    case "contact":
      return (
        "Puedes contactarnos por:\n\n" +
        `• Email: ${SUPPORT_EMAIL}\n` +
        `• WhatsApp: https://wa.me/${SUPPORT_WHATSAPP}\n\n` +
        "Si quieres, dime tu consulta y te ayudo por aquí primero."
      );

    default:
      return null;
  }
}

function safeParseJson(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: WidgetRequest = req.method === "GET" ? {} : await req.json();
    const message = (payload.message ?? "").toString();
    const intent = detectIntent(message);

    const businessType = businessTypeFromMessage(message);
    const locationHint = extractLocationHint(message);

    const faqReply = await getFaqReply(intent, supabase);
    if (faqReply) {
      // If user asked for services and also provided location/type hints, enrich with a small DB-backed suggestion list.
      if (intent === "services" && (businessType || locationHint)) {
        try {
          const hits = await searchCatalog(supabase, {
            query: businessType ? businessTypeLabel(businessType) : (locationHint ?? message),
            businessType,
            locationHint,
            limit: 5,
          });
          if (hits.length > 0) {
            const enriched =
              faqReply +
              "\n\n" +
              buildCatalogReply(hits, "Algunos resultados que encontré según lo que me dijiste:");
            const response: WidgetResponse = {
              reply: enriched,
              handoff: false,
              quickReplies: QUICK_REPLIES,
            };
            return jsonResponse(response, 200);
          }
        } catch (e) {
        }
      }

      const response: WidgetResponse = {
        reply: faqReply,
        handoff: false,
        quickReplies: QUICK_REPLIES,
      };
      return jsonResponse(response, 200);
    }

    // If user asks about schedules/hours and mentions a business/service, try to resolve and show schedule from DB.
    if (intent === "hours") {
      try {
        const hits = await searchCatalog(supabase, {
          query: message,
          businessType,
          locationHint,
          limit: 5,
        });

        if (hits.length === 1) {
          const partnerId = hits[0].partnerId;
          const { data: schedule, error: scheduleError } = await supabase
            .from("business_schedule")
            .select("day_of_week,start_time,end_time,is_active")
            .eq("partner_id", partnerId)
            .eq("is_active", true)
            .limit(50);

          if (scheduleError) throw scheduleError;

          const scheduleText = formatSchedule((schedule ?? []) as ScheduleRow[]);
          const response: WidgetResponse = {
            reply: `Horario de ${hits[0].partnerName}:\n\n${scheduleText}`,
            handoff: false,
            quickReplies: QUICK_REPLIES,
          };
          return jsonResponse(response, 200);
        }

        if (hits.length > 1) {
          const response: WidgetResponse = {
            reply: buildCatalogReply(hits, "Encontré más de un negocio relacionado. ¿A cuál te refieres para ver su horario?") ,
            handoff: false,
            quickReplies: QUICK_REPLIES,
          };
          return jsonResponse(response, 200);
        }
      } catch (e) {
      }
    }

    // Generic DB-backed search: helps answer many questions without IA.
    try {
      const hits = await searchCatalog(supabase, {
        query: message,
        businessType,
        locationHint,
        limit: 5,
      });

      if (hits.length > 0) {
        const intro =
          businessType || locationHint
            ? "Encontré estos resultados en DogCatiFy según tu consulta:"
            : "Encontré estos resultados relacionados en DogCatiFy:";

        const response: WidgetResponse = {
          reply: buildCatalogReply(hits, intro),
          handoff: false,
          quickReplies: QUICK_REPLIES,
        };
        return jsonResponse(response, 200);
      }
    } catch (e) {
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      const response: WidgetResponse = {
        reply:
          "No estoy 100% segura de la respuesta. Un agente se pondrá en contacto contigo para ayudarte.",
        handoff: true,
        quickReplies: QUICK_REPLIES,
      };
      return jsonResponse(response, 200);
    }

    // Provide a small live snapshot to the model to reduce hallucinations.
    let snapshotForModel: ServicesSnapshot | null = null;
    try {
      snapshotForModel = await getServicesSnapshot(supabase);
    } catch {
      snapshotForModel = null;
    }

    const systemPrompt =
      "Eres Dotty, un asistente para el WIDGET WEB flotante de DogCatiFy.\n" +
      "Respondes SOLO preguntas básicas y generales (servicios, cómo reservar, horarios, contacto, funcionamiento general).\n" +
      "No inventes datos. Si falta información o no puedes responder con seguridad, marca handoff=true.\n" +
      "No solicites datos sensibles. Si el usuario necesita ayuda humana, indica que un agente lo contactará.\n\n" +
      (snapshotForModel
        ? `Contexto (desde la base): tipos=${snapshotForModel.businessTypes.join("|")}; categorías=${snapshotForModel.categories.slice(0, 20).join("|")}.\n\n`
        : "") +
      `Contacto oficial: email ${SUPPORT_EMAIL} y WhatsApp https://wa.me/${SUPPORT_WHATSAPP}.\n\n` +
      "Devuelve ÚNICAMENTE JSON válido con esta forma:\n" +
      "{\n" +
      '  "reply": "...",\n' +
      '  "handoff": true|false\n' +
      "}";

    const history: ChatMessage[] = Array.isArray(payload.conversationHistory)
      ? payload.conversationHistory
          .filter((m) => m && typeof m.content === "string")
          .map((m): ChatMessage => {
            const role: Role = (m.role === "assistant" || m.role === "system") ? m.role : "user";
            return {
              role,
              content: m.content.slice(0, 2000),
            };
          })
          .slice(-10)
      : [];

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message.slice(0, 2000) },
    ];

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiResponse.ok) {
      const response: WidgetResponse = {
        reply:
          "Ahora mismo no puedo responder con seguridad. Un agente se pondrá en contacto contigo para ayudarte.",
        handoff: true,
        quickReplies: QUICK_REPLIES,
      };
      return jsonResponse(response, 200);
    }

    const openaiData = await openaiResponse.json();
    const assistantText = openaiData?.choices?.[0]?.message?.content;

    const parsed = typeof assistantText === "string" ? safeParseJson(assistantText) : null;
    const reply = typeof parsed?.reply === "string" && parsed.reply.trim().length > 0
      ? parsed.reply
      : "No estoy 100% segura de la respuesta. Un agente se pondrá en contacto contigo para ayudarte.";
    const handoff = typeof parsed?.handoff === "boolean" ? parsed.handoff : true;

    const response: WidgetResponse = {
      reply,
      handoff,
      quickReplies: QUICK_REPLIES,
    };

    return jsonResponse(response, 200);
  } catch (error) {
    return jsonResponse({ error: (error as Error)?.message ?? "Unknown error" }, 500);
  }
});
