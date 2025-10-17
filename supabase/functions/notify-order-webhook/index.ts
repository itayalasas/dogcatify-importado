import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WebhookSubscription {
  id: string;
  partner_id: string;
  webhook_url: string;
  events: string[];
  secret_key: string;
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
  const payload = {
    event: eventType,
    order_id: orderId,
    data: orderData,
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);
  const signature = await generateSignature(payloadString, subscription.secret_key);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to send webhook to ${subscription.webhook_url}`);

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

      const responseBody = await response.text();
      const success = response.ok;

      await supabase.from("webhook_logs").insert({
        webhook_subscription_id: subscription.id,
        order_id: orderId,
        event_type: eventType,
        payload,
        response_status: response.status,
        response_body: responseBody.substring(0, 1000),
        attempt_number: attempt,
        success,
      });

      if (success) {
        console.log(`Webhook sent successfully to ${subscription.webhook_url}`);
        return;
      } else {
        console.error(`Webhook failed with status ${response.status}: ${responseBody}`);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error: any) {
      console.error(`Error sending webhook (attempt ${attempt}):`, error);

      await supabase.from("webhook_logs").insert({
        webhook_subscription_id: subscription.id,
        order_id: orderId,
        event_type: eventType,
        payload,
        response_status: 0,
        response_body: error.message,
        attempt_number: attempt,
        success: false,
      });

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`Failed to send webhook after ${maxRetries} attempts`);
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        customer:profiles!orders_customer_id_fkey(
          id,
          full_name,
          email,
          phone,
          address,
          city,
          country
        )
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
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

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", "admin@dogcatify.com")
      .single();

    const adminId = adminProfile?.id || "00000000-0000-0000-0000-000000000000";

    const { data: subscriptions, error: subsError } = await supabase
      .from("webhook_subscriptions")
      .select("*")
      .or(`partner_id.eq.${order.partner_id},partner_id.eq.${adminId}`)
      .eq("is_active", true)
      .contains("events", [event_type]);

    if (subsError) {
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active webhooks found for partner ${order.partner_id} and event ${event_type}`);
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

    const notifications = subscriptions.map(subscription =>
      sendWebhookNotification(subscription, order_id, event_type, order, supabase)
    );

    await Promise.allSettled(notifications);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhooks notificados",
        webhooks_notified: subscriptions.length,
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
