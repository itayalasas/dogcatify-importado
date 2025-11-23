import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendToAccounting(
  orderId: string,
  orderData: any,
  supabase: any,
  accountingUrl: string,
  accountingApiKey: string,
  empresaId: string,
  maxRetries: number = 3
): Promise<{ success: boolean; response?: any; error?: string }> {
  console.log(`📨 Enviando orden ${orderId} al sistema contable`);

  try {
    // Obtener datos del cliente
    const { data: customerData, error: customerError } = await supabase
      .from("profiles")
      .select("id, display_name, email, phone")
      .eq("id", orderData.customer_id)
      .maybeSingle();

    if (customerError || !customerData) {
      console.error("❌ Error al obtener datos del cliente:", customerError);
      return { success: false, error: "Error al obtener datos del cliente" };
    }

    // Calcular totales
    const subtotal = parseFloat(orderData.subtotal) || 0;
    const ivaAmount = parseFloat(orderData.iva_amount) || 0;
    const total = parseFloat(orderData.total_amount) || 0;

    // Construir items con información del partner
    const items = [];

    if (orderData.items && Array.isArray(orderData.items)) {
      const partnerIds = [...new Set(orderData.items.map((item: any) => item.partnerId || item.partner_id))];

      // Obtener información de todos los partners en una sola consulta
      const { data: partnersData, error: partnersError } = await supabase
        .from("partners")
        .select("id, business_name, email, rut, commission_percentage")
        .in("id", partnerIds);

      if (partnersError) {
        console.error("❌ Error al obtener datos de partners:", partnersError);
        return { success: false, error: "Error al obtener datos de partners" };
      }

      const partnersMap = new Map(partnersData?.map((p: any) => [p.id, p]) || []);

      for (const item of orderData.items) {
        const partnerId = item.partnerId || item.partner_id;
        const partnerInfo = partnersMap.get(partnerId);

        if (!partnerInfo) {
          console.warn(`⚠️ No se encontró información del partner ${partnerId}`);
          continue;
        }

        // Calcular el precio unitario y total del item
        const quantity = parseInt(item.quantity) || 1;
        const unitPrice = parseFloat(item.price) || 0;
        const itemTotal = unitPrice * quantity;

        items.push({
          sku: item.sku || `ITEM-${item.id || Math.random().toString(36).substr(2, 9)}`,
          name: item.name || item.title || "Producto",
          quantity: quantity,
          unit_price: Number(unitPrice.toFixed(2)),
          total: Number(itemTotal.toFixed(2)),
          partner: {
            partner_id: partnerInfo.id,
            name: partnerInfo.business_name,
            email: partnerInfo.email,
            document_type: "RUT",
            document_number: partnerInfo.rut || "",
            commission_percentage: parseFloat(partnerInfo.commission_percentage) || 0
          }
        });
      }
    }

    // Construir el payload
    const payload = {
      event: "order.created",
      empresa_id: empresaId,
      timestamp: new Date().toISOString(),
      order: {
        order_id: orderData.id,
        order_number: orderData.order_number || `ORD-${orderData.id.substring(0, 8)}`,
        created_at: orderData.created_at,
        status: orderData.status,
        total: Number(total.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        tax: Number(ivaAmount.toFixed(2)),
        currency: "UYU",
        payment_status: orderData.payment_status || "paid"
      },
      customer: {
        customer_id: customerData.id,
        name: customerData.display_name || "Cliente",
        email: customerData.email || "",
        phone: customerData.phone || ""
      },
      items: items
    };

    const payloadString = JSON.stringify(payload);
    console.log("📦 Payload generado para contabilidad, longitud:", payloadString.length);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Intento ${attempt}/${maxRetries} - Enviando a ${accountingUrl}`);

        const response = await fetch(accountingUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Integration-Key": accountingApiKey,
          },
          body: payloadString,
        });

        console.log(`📥 Respuesta recibida: Status ${response.status}`);
        const responseBody = await response.text();
        const success = response.ok;

        console.log("💾 Guardando log en accounting_webhook_logs...");
        const logData = {
          order_id: orderId,
          payload: payload,
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          attempt_number: attempt,
          success,
          accounting_url: accountingUrl,
        };

        const { error: insertError } = await supabase
          .from("accounting_webhook_logs")
          .insert(logData);

        if (insertError) {
          console.error("❌ ERROR al insertar en accounting_webhook_logs:", insertError);
        } else {
          console.log("✅ Log guardado exitosamente");
        }

        if (success) {
          console.log(`✅ Webhook enviado exitosamente al sistema contable`);
          return { success: true, response: responseBody };
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
          await supabase.from("accounting_webhook_logs").insert({
            order_id: orderId,
            payload: payload,
            response_status: 0,
            response_body: attemptError.message,
            attempt_number: attempt,
            success: false,
            accounting_url: accountingUrl,
          });
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
    return { success: false, error: `Failed after ${maxRetries} attempts` };

  } catch (outerError: any) {
    console.error("❌ ERROR CRÍTICO en sendToAccounting:", outerError);
    return { success: false, error: outerError.message };
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

    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({
          error: "Parámetros faltantes",
          message: "Se requiere order_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const accountingWebhookUrl = Deno.env.get("ACCOUNTING_WEBHOOK_URL");
    const accountingApiKey = Deno.env.get("ACCOUNTING_API_KEY");
    const empresaId = Deno.env.get("ACCOUNTING_EMPRESA_ID");

    if (!accountingWebhookUrl || !accountingApiKey || !empresaId) {
      console.error("❌ Variables de entorno de contabilidad no configuradas");
      return new Response(
        JSON.stringify({
          error: "Configuración incompleta",
          message: "ACCOUNTING_WEBHOOK_URL, ACCOUNTING_API_KEY y ACCOUNTING_EMPRESA_ID deben estar configurados",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🔍 Buscando orden pagada: ${order_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        partner_id,
        customer_id,
        status,
        order_type,
        order_number,
        subtotal,
        shipping_cost,
        iva_rate,
        iva_amount,
        iva_included_in_price,
        total_amount,
        items,
        payment_method,
        payment_id,
        payment_status,
        created_at,
        updated_at
      `)
      .eq("id", order_id)
      .single();

    if (orderError) {
      console.error("❌ Error al obtener orden:", orderError);
      return new Response(
        JSON.stringify({
          error: "Error al obtener orden",
          message: orderError.message,
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

    // Solo enviar órdenes pagadas
    if (order.payment_status !== 'paid' && order.payment_status !== 'approved') {
      console.log(`⚠️ Orden no pagada, no se envía a contabilidad: ${order_id} (status: ${order.payment_status})`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Orden no pagada, no se envía a contabilidad",
          order_id: order_id,
          payment_status: order.payment_status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // No enviar órdenes gratuitas
    if (order.payment_method === 'free' || order.total_amount === 0) {
      console.log(`⚠️ Orden gratuita, no se envía a contabilidad: ${order_id}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Orden gratuita, no se envía a contabilidad",
          order_id: order_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Orden pagada encontrada: ${order.id}`);

    const result = await sendToAccounting(
      order_id,
      order,
      supabase,
      accountingWebhookUrl,
      accountingApiKey,
      empresaId
    );

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Orden enviada al sistema contable exitosamente",
          order_id: order_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error al enviar al sistema contable",
          message: result.error,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in send-order-to-accounting:", error);
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
