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
    console.error("Error verificando firma:", error);
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

    console.log("\n📥 Webhook recibido:");
    console.log(`  Evento: ${eventType}`);
    console.log(`  Firma: ${signature?.substring(0, 16)}...`);

    if (!signature) {
      console.error("❌ Sin firma de seguridad");
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
    const defaultSecret = "default_webhook_secret_key_2024";
    const correctSecret = "Kzdr7C4eF9IS4EIgmH8LARdwWrvH4jCBMDOTM1SHofZNdDUHpiFEYH3WhRWx";

    const webhookSecret = webhookSecretEnv || correctSecret;

    console.log("🔍 DEBUG INFO:");
    console.log(`  WEBHOOK_SECRET env var exists: ${webhookSecretEnv ? 'YES' : 'NO'}`);
    console.log(`  Using secret: ${webhookSecret === defaultSecret ? 'DEFAULT' : webhookSecret === correctSecret ? 'CORRECT' : 'ENV VAR'}`);
    console.log(`  Body length: ${rawBody.length}`);
    console.log(`  Body first 500 chars: ${rawBody.substring(0, 500)}`);
    console.log(`  Secret length: ${webhookSecret.length}`);
    console.log(`  Secret preview: ${webhookSecret.substring(0, 15)}...`);
    console.log(`  Signature received: ${signature}`);

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
    console.log(`  Signature expected: ${expectedSignature}`);
    console.log(`  Signatures match: ${signature === expectedSignature}`);

    // Verificar firma con el body RAW
    const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error("❌ Firma inválida");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Firma verificada correctamente");

    // Parsear el payload
    const payload = JSON.parse(rawBody);
    const { event, order_id, data, timestamp } = payload;

    console.log(`\n⏱️  Timestamp del evento: ${timestamp}`);
    console.log(`📦 Orden ID: ${order_id}`);
    console.log(`🔔 Evento: ${event}`);

    // Procesar según el tipo de evento
    switch (event) {
      case "order.created":
        console.log("\n🆕 NUEVA ORDEN CREADA");
        console.log(`  Cliente: ${data.customer_name} (${data.customer_email})`);
        console.log(`  Total: $${data.total_amount}`);
        console.log(`  Items:`, data.items?.length || 0);
        break;

      case "order.updated":
        console.log("\n🔄 ORDEN ACTUALIZADA");
        console.log(`  Nuevo status: ${data.status}`);
        break;

      case "order.cancelled":
        console.log("\n❌ ORDEN CANCELADA");
        console.log(`  Total cancelado: $${data.total_amount}`);
        break;

      case "order.completed":
        console.log("\n✅ ORDEN COMPLETADA");
        console.log(`  Total: $${data.total_amount}`);
        break;

      default:
        console.warn(`⚠️  Evento desconocido: ${event}`);
    }

    console.log("✅ Webhook procesado exitosamente");

    // Responder rápidamente
    return new Response(
      JSON.stringify({ received: true, order_id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("❌ Error procesando webhook:", error);
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