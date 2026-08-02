import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-DogCatiFy-Signature, X-DogCatiFy-Event",
};

async function verifyWebhookSignature(rawBody: string, signature: string, secretKey: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(rawBody);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return signature === expectedSignature;
  } catch (error) {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const signature = req.headers.get("x-dogcatify-signature");
    const eventType = req.headers.get("x-dogcatify-event");


    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Sin firma de seguridad" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Leer el body RAW
    const rawBody = await req.text();

    // Obtener el secret key
    const webhookSecretEnv = Deno.env.get("WEBHOOK_SECRET");

    const webhookSecret = webhookSecretEnv;

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }


    // Generar firma esperada para debug
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const messageData = encoder.encode(rawBody);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Verificar firma con el body RAW
    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }


    // Parsear el payload
    const payload = JSON.parse(rawBody);
    const { event, order_id, data, timestamp } = payload;


    // Procesar según el tipo de evento
    switch (event) {
      case "order.created":
        break;

      case "order.updated":
        break;

      case "order.cancelled":
        break;

      case "order.completed":
        break;

      default:
    }


    // Responder rápidamente
    return new Response(
      JSON.stringify({ received: true, order_id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: "Error interno",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
