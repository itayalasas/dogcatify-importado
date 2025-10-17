import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WebhookSubscription {
  id: string;
  webhook_url: string;
  secret_key: string;
  events: string[];
  is_active: boolean;
}

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

async function sendWebhookNotification(
  subscription: WebhookSubscription,
  orderId: string,
  eventType: string,
  orderData: any,
  supabase: any,
  maxRetries: number = 3
): Promise<void> {
  console.log(`📨 sendWebhookNotification iniciada para orden ${orderId}`);

  try {
    console.log("🔨 Creando objeto payload...");
    const payload = {
      event: eventType,
      order_id: orderId,
      data: orderData,
      timestamp: new Date().toISOString(),
    };
    console.log("✅ Objeto payload creado");

    console.log("🔨 Convirtiendo payload a JSON string...");
    let payloadString: string;
    try {
      payloadString = JSON.stringify(payload);
      console.log("✅ Payload convertido a string, longitud:", payloadString.length);
      console.log("📦 Payload preview:", payloadString.substring(0, 300));
    } catch (jsonError: any) {
      console.error("❌ ERROR al hacer JSON.stringify:", jsonError.message);
      throw jsonError;
    }

    console.log("🔨 Generando firma HMAC...");
    console.log("🔑 Secret key length:", subscription.secret_key?.length || 0);

    if (!subscription.secret_key || subscription.secret_key.length === 0) {
      console.error("❌ ERROR: secret_key está vacío!");
      throw new Error("Secret key is empty");
    }

    const signature = await generateSignature(payloadString, subscription.secret_key);
    console.log("✅ Firma generada");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Intento ${attempt}/${maxRetries} - Enviando a ${subscription.webhook_url}`);

        const response = await fetch(subscription.webhook_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-DogCatiFy-Signature": signature,
            "X-DogCatiFy-Event": eventType,
            "User-Agent": "DogCatiFy-Webhook/1.0",
          },
          body: payloadString,
        });

        console.log(`📥 Respuesta recibida: Status ${response.status}`);
        const responseBody = await response.text();
        const success = response.ok;

        console.log("💾 Guardando log en webhook_logs...");
        const logData = {
          webhook_subscription_id: subscription.id,
          order_id: orderId,
          event_type: eventType,
          payload: payload,
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          attempt_number: attempt,
          success,
        };
        console.log("📋 Log data preparado (payload es objeto JSON)");

        const { error: insertError } = await supabase.from("webhook_logs").insert(logData);

        if (insertError) {
          console.error("❌ ERROR al insertar en webhook_logs:", insertError);
          throw insertError;
        }

        console.log("✅ Log guardado exitosamente");

        if (success) {
          console.log(`✅ Webhook enviado exitosamente a ${subscription.webhook_url}`);
          return;
        } else {
          console.error(`⚠️ Webhook falló con status ${response.status}: ${responseBody.substring(0, 100)}`);

          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`⏳ Reintentando en ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (attemptError: any) {
        console.error(`❌ Error en intento ${attempt}:`, attemptError.message);

        try {
          console.log("💾 Guardando log de error...");
          await supabase.from("webhook_logs").insert({
            webhook_subscription_id: subscription.id,
            order_id: orderId,
            event_type: eventType,
            payload: payload,
            response_status: 0,
            response_body: attemptError.message,
            attempt_number: attempt,
            success: false,
          });
          console.log("✅ Log de error guardado");
        } catch (logError: any) {
          console.error("❌ ERROR al guardar log de error:", logError);
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏳ Reintentando en ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`❌ Falló después de ${maxRetries} intentos`);
  } catch (outerError: any) {
    console.error("❌ ERROR CRÍTICO en sendWebhookNotification:", outerError);
    console.error("Stack:", outerError.stack);
    throw outerError;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { order_id, event_type } = await req.json();

    if (!order_id || !event_type) {
      return new Response(
        JSON.stringify({
          error: "Parámetros faltantes",
          message: "Se requieren order_id y event_type",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validEvents = ["order.created", "order.updated", "order.cancelled", "order.completed"];
    if (!validEvents.includes(event_type)) {
      return new Response(
        JSON.stringify({
          error: "Tipo de evento inválido",
          message: `El evento debe ser uno de: ${validEvents.join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🔍 Buscando orden: ${order_id}, evento: ${event_type}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query completa con todos los campos JSONB y JOIN a customer
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        partner_id,
        customer_id,
        status,
        order_type,
        subtotal,
        iva_rate,
        iva_amount,
        total_amount,
        items,
        shipping_address,
        payment_method,
        payment_id,
        payment_status,
        payment_preference_id,
        commission_amount,
        partner_amount,
        booking_id,
        service_id,
        appointment_date,
        appointment_time,
        pet_id,
        booking_notes,
        created_at,
        updated_at,
        customer:profiles!orders_customer_id_fkey(
          id,
          display_name,
          email,
          phone,
          calle,
          numero,
          barrio,
          codigo_postal,
          location
        )
      `)
      .eq("id", order_id)
      .single();

    if (orderError) {
      console.error("❌ Error al obtener orden:", orderError);
      return new Response(
        JSON.stringify({
          error: "Error al obtener orden",
          message: orderError.message,
          details: orderError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!order) {
      console.error("❌ Orden no encontrada:", order_id);
      return new Response(
        JSON.stringify({
          error: "Orden no encontrada",
          message: `No se encontró la orden con ID ${order_id}`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Orden encontrada: ${order.id}, Partner: ${order.partner_id}`);

    console.log(`🔍 Buscando webhooks activos para evento ${event_type}...`);

    // Obtener secret global de variable de entorno
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET") || "default_webhook_secret_key_2024";

    const { data: subscriptions, error: subsError } = await supabase
      .from("webhook_subscriptions")
      .select("id, webhook_url, events, is_active")
      .eq("is_active", true);

    if (subsError) {
      console.error("❌ Error al buscar subscripciones:", subsError);
      return new Response(
        JSON.stringify({
          error: "Error al buscar webhooks",
          message: subsError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filtrar por evento que contenga el event_type
    const filteredSubscriptions = subscriptions?.filter(sub =>
      sub.events && Array.isArray(sub.events) && sub.events.includes(event_type)
    ) || [];

    console.log(`✅ Webhooks activos encontrados: ${filteredSubscriptions.length}`);

    if (filteredSubscriptions.length === 0) {
      console.log(`⚠️ No active webhooks found for event ${event_type}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "No hay webhooks activos para este evento",
          webhooks_notified: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Agregar secret_key a cada subscription
    const subscriptionsWithSecret = filteredSubscriptions.map(sub => ({
      ...sub,
      secret_key: webhookSecret,
    }));

    console.log("🚀 Iniciando envío de webhooks...");
    const notifications = subscriptionsWithSecret.map(subscription =>
      sendWebhookNotification(subscription, order_id, event_type, order, supabase)
    );

    console.log("⏳ Esperando respuesta de webhooks...");
    await Promise.allSettled(notifications);
    console.log("✅ Webhooks procesados");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhooks notificados",
        webhooks_notified: filteredSubscriptions.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-order-webhook:", error);
    return new Response(
      JSON.stringify({
        error: "Error interno del servidor",
        message: error.message || "Ocurrió un error al procesar la petición",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
