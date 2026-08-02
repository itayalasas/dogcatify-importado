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

async function buildPartnersArray(orderData: any, supabase: any): Promise<any[]> {
  const partnersArray: any[] = [];

  const partnerBreakdown = orderData.partner_breakdown?.partners || {};
  let partnerIds = Object.keys(partnerBreakdown);

  if (partnerIds.length === 0 && orderData.partner_id) {
    partnerIds = [orderData.partner_id];
  }

  if (partnerIds.length === 0) {
    return [];
  }

  const { data: partnersData, error } = await supabase
    .from("partners")
    .select("id, business_name, email, phone, calle, numero, barrio, codigo_postal, rut, commission_percentage")
    .in("id", partnerIds);

  if (error || !partnersData) {
    return [];
  }

  const ivaIncludedInPrice = orderData.iva_included_in_price === true;
  const ivaRate = orderData.iva_rate || 0;

  for (const partnerId of partnerIds) {
    const partnerInfo = partnersData.find((p: any) => p.id === partnerId);

    if (!partnerInfo) {
      continue;
    }

    // Para productos: filtrar items por partnerId
    // Para servicios: usar todos los items (no tienen partnerId)
    let partnerItems = partnerBreakdown[partnerId]
      ? (orderData.items || []).filter((item: any) => item.partnerId === partnerId || item.partner_id === partnerId)
      : (orderData.items || []);

    let subtotal = 0;
    let ivaAmount = 0;

    if (partnerBreakdown[partnerId]) {
      // PRODUCTOS: Los valores del breakdown YA VIENEN CORRECTOS desde mercadoPago.ts
      // - subtotal: ya está sin IVA
      // - items: ya tienen subtotal sin IVA y iva_amount calculado
      // NO necesitamos recalcular nada, solo usar los valores tal cual

      subtotal = partnerBreakdown[partnerId].subtotal || 0;

      // Calcular IVA sumando los iva_amount de los items
      ivaAmount = partnerItems.reduce((sum: number, item: any) => sum + (item.iva_amount || 0), 0);


      // Los items ya vienen correctos, no necesitamos ajustarlos
    } else {
      // SERVICIOS: Los items vienen de la orden directamente
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

    // Para servicios, enriquecer los items con información del booking
    const enrichedItems = partnerItems.map((item: any) => {
      // Calcular discount_amount basado en discount_percentage
      const discountPercentage = item.discount_percentage || 0;
      const originalPrice = item.original_price || item.price;
      const discountAmount = discountPercentage > 0
        ? Number(((originalPrice * discountPercentage / 100) * item.quantity).toFixed(2))
        : 0;

      // Si es un servicio y tenemos booking_info, agregar esos datos
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

      // Para productos, solo agregar discount_amount
      return {
        ...item,
        discount_amount: discountAmount
      };
    });

    // Calculate partner total: subtotal + IVA
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

async function sendWebhookNotification(
  subscription: WebhookSubscription,
  orderId: string,
  eventType: string,
  orderData: any,
  supabase: any,
  maxRetries: number = 3
): Promise<void> {

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

    // IMPORTANTE: Los valores de la orden YA VIENEN CORRECTOS desde mercadoPago.ts
    // - subtotal: ya está sin IVA
    // - iva_amount: ya está calculado correctamente
    // NO necesitamos recalcular, solo usar los valores tal cual

    const subtotalSinIva = orderData.subtotal || 0;
    const ivaAmountCalculado = orderData.iva_amount || 0;


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

    let payloadString: string;
    try {
      payloadString = JSON.stringify(payload);
    } catch (jsonError: any) {
      throw jsonError;
    }


    if (!subscription.secret_key || subscription.secret_key.length === 0) {
      throw new Error("Secret key is empty");
    }

    const signature = await generateSignature(payloadString, subscription.secret_key);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {

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

        const { error: insertError } = await supabase.from("webhook_logs").insert(logData);

        if (insertError) {
          throw insertError;
        }


        if (success) {
          return;
        } else {

          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (attemptError: any) {

        try {
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
        } catch (logError: any) {
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

  } catch (outerError: any) {
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



    const webhookSecretEnv = Deno.env.get("WEBHOOK_SECRET");
    const webhookSecret = webhookSecretEnv;

    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }


    const { data: subscriptions, error: subsError } = await supabase
      .from("webhook_subscriptions")
      .select("id, webhook_url, events, is_active")
      .eq("is_active", true);

    if (subsError) {
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

    const filteredSubscriptions = subscriptions?.filter(sub =>
      sub.events && Array.isArray(sub.events) && sub.events.includes(event_type)
    ) || [];


    if (filteredSubscriptions.length === 0) {
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

    const subscriptionsWithSecret = filteredSubscriptions.map(sub => ({
      ...sub,
      secret_key: webhookSecret,
    }));

    const notifications = subscriptionsWithSecret.map(subscription =>
      sendWebhookNotification(subscription, order_id, event_type, order, supabase)
    );

    await Promise.allSettled(notifications);

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
