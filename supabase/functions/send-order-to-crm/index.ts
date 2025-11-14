import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function buildPartnersArray(orderData: any, supabase: any): Promise<any[]> {
  const partnersArray: any[] = [];

  const partnerBreakdown = orderData.partner_breakdown?.partners || {};
  let partnerIds = Object.keys(partnerBreakdown);

  if (partnerIds.length === 0 && orderData.partner_id) {
    partnerIds = [orderData.partner_id];
  }

  if (partnerIds.length === 0) {
    console.warn("⚠️ No se encontraron partners para esta orden");
    return [];
  }

  const { data: partnersData, error } = await supabase
    .from("partners")
    .select("id, business_name, email, phone, calle, numero, barrio, codigo_postal, rut, commission_percentage")
    .in("id", partnerIds);

  if (error || !partnersData) {
    console.error("❌ Error al obtener datos de partners:", error);
    return [];
  }

  const ivaIncludedInPrice = orderData.iva_included_in_price === true;
  const ivaRate = orderData.iva_rate || 0;

  for (const partnerId of partnerIds) {
    const partnerInfo = partnersData.find((p: any) => p.id === partnerId);

    if (!partnerInfo) {
      console.warn(`⚠️ No se encontró información del partner ${partnerId}`);
      continue;
    }

    let partnerItems = partnerBreakdown[partnerId]
      ? (orderData.items || []).filter((item: any) => item.partnerId === partnerId || item.partner_id === partnerId)
      : (orderData.items || []);

    let subtotal = 0;
    let ivaAmount = 0;

    if (partnerBreakdown[partnerId]) {
      subtotal = partnerBreakdown[partnerId].subtotal || 0;
      ivaAmount = partnerItems.reduce((sum: number, item: any) => sum + (item.iva_amount || 0), 0);
    } else {
      if (partnerItems.length > 0) {
        const totalConIva = partnerItems.reduce((sum: number, item: any) => {
          return sum + ((item.subtotal !== undefined && item.subtotal !== null) ? item.subtotal : (item.price * item.quantity));
        }, 0);

        if (ivaIncludedInPrice && ivaRate > 0) {
          subtotal = totalConIva / (1 + ivaRate / 100);
          ivaAmount = totalConIva - subtotal;

          partnerItems = partnerItems.map((item: any) => {
            const itemPrice = item.price || 0;
            const itemSubtotal = item.subtotal || (itemPrice * item.quantity);

            const priceWithoutIva = itemPrice / (1 + ivaRate / 100);
            const subtotalWithoutIva = itemSubtotal / (1 + ivaRate / 100);
            const itemIvaAmount = itemSubtotal - subtotalWithoutIva;

            return {
              ...item,
              price: Number(priceWithoutIva.toFixed(2)),
              subtotal: Number(subtotalWithoutIva.toFixed(2)),
              iva_amount: Number(itemIvaAmount.toFixed(2)),
              original_price: itemPrice
            };
          });
        } else {
          subtotal = totalConIva;
          ivaAmount = partnerItems.reduce((sum: number, item: any) => sum + (item.iva_amount || 0), 0);
        }
      } else {
        subtotal = orderData.subtotal || 0;

        if (ivaIncludedInPrice && ivaRate > 0) {
          const subtotalSinIva = subtotal / (1 + ivaRate / 100);
          ivaAmount = subtotal - subtotalSinIva;
          subtotal = subtotalSinIva;
        } else {
          ivaAmount = orderData.iva_amount || 0;
        }
      }
    }

    const commissionPercentage = partnerInfo.commission_percentage || 5.0;
    const commissionAmount = (subtotal * commissionPercentage) / 100;
    const partnerAmount = subtotal - commissionAmount;

    const enrichedItems = partnerItems.map((item: any) => {
      const discountPercentage = item.discount_percentage || 0;
      const originalPrice = item.original_price || item.price;
      const discountAmount = discountPercentage > 0
        ? Number(((originalPrice * discountPercentage / 100) * item.quantity).toFixed(2))
        : 0;

      if (orderData.order_type === 'service_booking' && orderData.booking_id) {
        return {
          ...item,
          service_name: orderData.service_name || item.name,
          pet_name: orderData.pet_name,
          pet_id: orderData.pet_id,
          appointment_date: orderData.appointment_date,
          appointment_time: orderData.appointment_time,
          booking_notes: orderData.booking_notes,
          discount_amount: discountAmount,
          type: 'service'
        };
      }

      return {
        ...item,
        discount_amount: discountAmount
      };
    });

    const partnerTotal = subtotal + ivaAmount;

    partnersArray.push({
      id: partnerInfo.id,
      business_name: partnerInfo.business_name,
      email: partnerInfo.email,
      phone: partnerInfo.phone,
      rut: partnerInfo.rut,
      calle: partnerInfo.calle,
      numero: partnerInfo.numero,
      barrio: partnerInfo.barrio,
      codigo_postal: partnerInfo.codigo_postal,
      commission_percentage: commissionPercentage,
      is_primary: partnerId === orderData.partner_id,
      items: enrichedItems,
      subtotal: Number(subtotal.toFixed(2)),
      iva_amount: Number(ivaAmount.toFixed(2)),
      commission_amount: Number(commissionAmount.toFixed(2)),
      partner_amount: Number(partnerAmount.toFixed(2)),
      total: Number(partnerTotal.toFixed(2))
    });
  }

  return partnersArray;
}

async function sendToCRM(
  orderId: string,
  eventType: string,
  orderData: any,
  supabase: any,
  crmUrl: string,
  crmApiKey: string,
  maxRetries: number = 3
): Promise<{ success: boolean; response?: any; error?: string }> {
  console.log(`📨 Enviando orden ${orderId} al CRM con evento: ${eventType}`);

  try {
    const shippingCost = orderData.shipping_cost || 0;
    const shippingIvaAmount = orderData.iva_rate && !orderData.iva_included_in_price
      ? (shippingCost * orderData.iva_rate / 100)
      : 0;

    const shippingInfo = orderData.order_type === 'product_purchase' ? {
      shipping_cost: shippingCost,
      shipping_iva_amount: shippingIvaAmount,
      shipping_total: shippingCost + shippingIvaAmount,
      shipping_address: orderData.shipping_address || null,
    } : {
      shipping_cost: null,
      shipping_iva_amount: null,
      shipping_total: null,
      shipping_address: null,
    };

    const partnersArray = await buildPartnersArray(orderData, supabase);
    const totalPartners = partnersArray.length;

    const subtotalSinIva = orderData.subtotal || 0;
    const ivaAmountCalculado = orderData.iva_amount || 0;

    console.log(`📊 Totales de orden: Subtotal=${subtotalSinIva.toFixed(2)}, IVA=${ivaAmountCalculado.toFixed(2)}, Total=${orderData.total_amount}`);

    const payload = {
      data: {
        id: orderData.id,
        status: orderData.status,
        order_type: orderData.order_type,
        payment_method: orderData.payment_method,
        customer: orderData.customer,
        partners: partnersArray,
        totals: {
          subtotal: Number(subtotalSinIva.toFixed(2)),
          iva_amount: Number(ivaAmountCalculado.toFixed(2)),
          iva_rate: orderData.iva_rate,
          iva_included_in_price: orderData.iva_included_in_price === true,
          shipping_cost: shippingCost,
          shipping_iva_amount: shippingIvaAmount,
          total_commission: orderData.commission_amount,
          total_partner_amount: orderData.partner_amount,
          total_amount: orderData.total_amount,
          total_partners: totalPartners
        },
        shipping_info: shippingInfo,
        payment_info: {
          payment_id: orderData.payment_id,
          payment_status: orderData.payment_status,
          payment_method: orderData.payment_method,
          payment_preference_id: orderData.payment_preference_id
        },
        booking_info: orderData.booking_id ? {
          booking_id: orderData.booking_id,
          service_id: orderData.service_id,
          appointment_date: orderData.appointment_date,
          appointment_time: orderData.appointment_time,
          pet_id: orderData.pet_id,
          pet_name: orderData.pet_name,
          booking_notes: orderData.booking_notes
        } : null,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at
      },
      event: eventType,
      order_id: orderId,
      timestamp: new Date().toISOString(),
    };

    const payloadString = JSON.stringify(payload);
    console.log("📦 Payload generado, longitud:", payloadString.length);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Intento ${attempt}/${maxRetries} - Enviando a ${crmUrl}`);

        const response = await fetch(crmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": crmApiKey,
            "User-Agent": "DogCatiFy-CRM-Webhook/1.0",
          },
          body: payloadString,
        });

        console.log(`📥 Respuesta recibida: Status ${response.status}`);
        const responseBody = await response.text();
        const success = response.ok;

        console.log("💾 Guardando log en crm_webhook_logs...");
        const logData = {
          order_id: orderId,
          event_type: eventType,
          payload: payload,
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          attempt_number: attempt,
          success,
          crm_url: crmUrl,
        };

        const { error: insertError } = await supabase.from("crm_webhook_logs").insert(logData);

        if (insertError) {
          console.error("❌ ERROR al insertar en crm_webhook_logs:", insertError);
        } else {
          console.log("✅ Log guardado exitosamente");
        }

        if (success) {
          console.log(`✅ Webhook enviado exitosamente al CRM`);
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
          await supabase.from("crm_webhook_logs").insert({
            order_id: orderId,
            event_type: eventType,
            payload: payload,
            response_status: 0,
            response_body: attemptError.message,
            attempt_number: attempt,
            success: false,
            crm_url: crmUrl,
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
    console.error("❌ ERROR CRÍTICO en sendToCRM:", outerError);
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

    const validEvents = ["order.created", "order.updated", "order.cancelled", "order.completed", "order.confirmed", "order.payment_updated"];
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

    const crmWebhookUrl = Deno.env.get("CRM_WEBHOOK_URL");
    const crmApiKey = Deno.env.get("CRM_API_KEY");

    if (!crmWebhookUrl || !crmApiKey) {
      console.error("❌ CRM_WEBHOOK_URL o CRM_API_KEY no configurados");
      return new Response(
        JSON.stringify({
          error: "Configuración incompleta",
          message: "CRM_WEBHOOK_URL y CRM_API_KEY deben estar configurados en las variables de entorno",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🔍 Buscando orden: ${order_id}, evento: ${event_type}`);
    console.log(`🎯 CRM URL: ${crmWebhookUrl}`);

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
        subtotal,
        shipping_cost,
        iva_rate,
        iva_amount,
        iva_included_in_price,
        total_amount,
        items,
        shipping_address,
        payment_method,
        payment_id,
        payment_status,
        payment_preference_id,
        commission_amount,
        partner_amount,
        partner_breakdown,
        booking_id,
        service_id,
        appointment_date,
        appointment_time,
        pet_id,
        booking_notes,
        partner_name,
        service_name,
        pet_name,
        customer_name,
        customer_email,
        customer_phone,
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
        ),
        partner:partners(
          id,
          business_name,
          email,
          phone,
          calle,
          numero,
          barrio,
          codigo_postal,
          rut,
          commission_percentage
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

    if (order.payment_method === 'free' || order.total_amount === 0) {
      console.log(`⚠️ Orden gratuita, no se envía al CRM: ${order_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Orden gratuita, no se envía al CRM",
          order_id: order_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Orden encontrada: ${order.id}`);

    const result = await sendToCRM(order_id, event_type, order, supabase, crmWebhookUrl, crmApiKey);

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Orden enviada al CRM exitosamente",
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
          error: "Error al enviar al CRM",
          message: result.error,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in send-order-to-crm:", error);
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
