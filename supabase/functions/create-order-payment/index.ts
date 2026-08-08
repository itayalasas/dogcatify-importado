import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.43.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MP_BASE_URL = "https://api.mercadopago.com";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getSupabase = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new HttpError(500, "SUPABASE_ENV_REQUIRED");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getAuthUser = async (supabase: any, req: Request) => {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "AUTH_REQUIRED");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, "INVALID_AUTH_TOKEN");
  return data.user;
};

const fetchMercadoPago = async (accessToken: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`${MP_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });
  const rawBody = await response.text();
  let body: any = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = rawBody;
  }
  if (!response.ok) {
    const message = typeof body === "object"
      ? body?.message || body?.error || JSON.stringify(body)
      : String(body || response.statusText);
    throw new HttpError(response.status, `MERCADOPAGO_API_ERROR: ${message}`);
  }
  return body;
};

const validateToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(`${MP_BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Partner payment config resolution — mirrors utils/mercadoPago.ts's
// getPartnerMercadoPagoConfig() exactly, but server-side: reads the token
// from partner_payment_credentials (never sent to any client), refreshes it
// via the mercadopago-oauth function if expired, and falls back to the
// legacy admin marketplace token (admin_settings) for partners who haven't
// migrated to OAuth — same precedence as today.
// ---------------------------------------------------------------------------

type PartnerPaymentConfig = {
  access_token: string;
  public_key: string;
  refresh_token?: string | null;
  mp_user_id?: string | null;
  is_oauth: boolean;
  is_test_mode: boolean;
  commission_percentage: number;
  business_name: string;
  iva_rate: number;
  iva_included_in_price: boolean;
};

const getLegacyAdminConfig = async (supabase: any) => {
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("key", "mercadopago_config")
    .maybeSingle();
  if (error) throw new HttpError(500, `LEGACY_MP_CONFIG_READ_FAILED: ${error.message}`);
  const value = data?.value || {};
  if (!value.access_token) throw new HttpError(400, "LEGACY_MP_CONFIG_NOT_FOUND");
  return {
    access_token: value.access_token as string,
    public_key: (value.public_key as string) || "",
    is_test_mode: Boolean(value.is_test_mode),
  };
};

const getPartnerPaymentConfig = async (
  supabase: any,
  partnerId: string,
): Promise<PartnerPaymentConfig> => {
  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("business_name, commission_percentage, iva_rate, iva_included_in_price, user_id")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError) throw new HttpError(500, `PARTNER_READ_FAILED: ${partnerError.message}`);
  if (!partner) throw new HttpError(404, "PARTNER_NOT_FOUND");

  const { data: creds, error: credsError } = await supabase
    .from("partner_payment_credentials")
    .select("*")
    .eq("user_id", partner.user_id)
    .maybeSingle();

  if (credsError) throw new HttpError(500, `MP_CREDENTIALS_READ_FAILED: ${credsError.message}`);

  const hasPartnerOAuth = creds?.is_oauth === true || !!creds?.refresh_token;

  const commonFields = {
    commission_percentage: partner.commission_percentage || 5.0,
    business_name: partner.business_name,
    iva_rate: partner.iva_rate != null ? parseFloat(String(partner.iva_rate)) : 22.0,
    iva_included_in_price: partner.iva_included_in_price !== false,
  };

  if (hasPartnerOAuth) {
    let accessToken = creds.access_token as string;
    const tokenIsValid = accessToken ? await validateToken(accessToken) : false;

    if (!tokenIsValid) {
      if (!creds.refresh_token) {
        throw new HttpError(400, "MERCADOPAGO_REAUTH_REQUIRED");
      }

      const { data: refreshResult, error: refreshError } = await supabase.functions.invoke(
        "mercadopago-oauth",
        { body: { action: "refresh", partnerId } },
      );

      if (refreshError || !refreshResult?.success) {
        throw new HttpError(400, "MERCADOPAGO_REAUTH_REQUIRED");
      }

      const { data: refreshedCreds, error: refreshedCredsError } = await supabase
        .from("partner_payment_credentials")
        .select("*")
        .eq("user_id", partner.user_id)
        .maybeSingle();

      if (refreshedCredsError || !refreshedCreds?.access_token) {
        throw new HttpError(400, "MERCADOPAGO_REAUTH_REQUIRED");
      }

      accessToken = refreshedCreds.access_token;
      creds.refresh_token = refreshedCreds.refresh_token;
      creds.public_key = refreshedCreds.public_key;
      creds.mp_user_id = refreshedCreds.mp_user_id;
      creds.is_test_mode = refreshedCreds.is_test_mode;
    }

    return {
      access_token: accessToken,
      public_key: creds.public_key || "",
      refresh_token: creds.refresh_token,
      mp_user_id: creds.mp_user_id || partner.user_id,
      is_oauth: true,
      is_test_mode: Boolean(creds.is_test_mode),
      ...commonFields,
    };
  }

  const legacy = await getLegacyAdminConfig(supabase);
  return {
    access_token: legacy.access_token,
    public_key: legacy.public_key,
    is_oauth: false,
    is_test_mode: legacy.is_test_mode,
    ...commonFields,
  };
};

// ---------------------------------------------------------------------------
// IVA calculation — identical to utils/mercadoPago.ts's calculateIVA()
// ---------------------------------------------------------------------------

const calculateIVA = (itemsTotal: number, ivaRate: number) => {
  const totalAmount = Math.round(itemsTotal * 100) / 100;
  const subtotal = Math.round((totalAmount / (1 + ivaRate / 100)) * 100) / 100;
  const ivaAmount = totalAmount - subtotal;
  return { subtotal, ivaAmount, totalAmount };
};

const buildNotificationUrl = (supabaseUrl: string) => `${supabaseUrl}/functions/v1/mercadopago-webhook`;

const cleanPhoneNumber = (raw: string | null | undefined) => {
  const cleaned = String(raw || "99999999").replace(/\D/g, "");
  return cleaned.length >= 8 ? cleaned.slice(-8) : "99999999";
};

// ---------------------------------------------------------------------------
// action: product — replaces createMultiPartnerOrder + createUnifiedPaymentPreference
// ---------------------------------------------------------------------------

const handleProductOrder = async (supabase: any, supabaseUrl: string, user: any, body: any) => {
  const cartItems: any[] = Array.isArray(body.cartItems) ? body.cartItems : [];
  const shippingAddress: string = body.shippingAddress || "";
  const totalShippingCost: number = Number(body.totalShippingCost) || 0;

  if (!cartItems.length) throw new HttpError(400, "CART_EMPTY");

  const uniquePartnerIds = [...new Set(cartItems.map((i) => String(i.partnerId || "").trim()).filter(Boolean))];
  if (uniquePartnerIds.length > 1) {
    throw new HttpError(400, "MULTIPLE_STORES_NOT_SUPPORTED");
  }
  const partnerId = uniquePartnerIds[0];
  if (!partnerId) throw new HttpError(400, "PARTNER_ID_REQUIRED");

  const partnerConfig = await getPartnerPaymentConfig(supabase, partnerId);

  const itemsTotal = cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const iva = calculateIVA(itemsTotal, partnerConfig.iva_rate);
  const totalAmount = iva.totalAmount + totalShippingCost;
  const commissionAmount = totalAmount * (partnerConfig.commission_percentage / 100);
  const partnerAmount = totalAmount - commissionAmount;

  const itemsWithIVA = cartItems.map((item) => {
    const itemIvaRate = item.iva_rate ?? partnerConfig.iva_rate;
    const itemPrice = Math.round(Number(item.price) * Number(item.quantity) * 100) / 100;
    const itemSubtotal = itemIvaRate > 0 ? Math.round((itemPrice / (1 + itemIvaRate / 100)) * 100) / 100 : itemPrice;
    const itemIVA = itemPrice - itemSubtotal;
    return {
      ...item,
      subtotal: itemSubtotal,
      iva_rate: itemIvaRate,
      iva_amount: itemIVA,
      discount_percentage: item.discount_percentage ?? 0,
      original_price: item.original_price ?? item.price,
      currency: item.currency || "UYU",
      currency_code_dgi: item.currency_code_dgi || "858",
    };
  });

  const orderData = {
    partner_id: partnerId,
    customer_id: user.id,
    partner_name: partnerConfig.business_name,
    customer_name: body.customerInfo?.displayName || "Usuario",
    customer_email: body.customerInfo?.email || user.email,
    customer_phone: body.customerInfo?.phone || null,
    items: itemsWithIVA,
    subtotal: iva.subtotal,
    iva_rate: partnerConfig.iva_rate,
    iva_amount: iva.ivaAmount,
    iva_included_in_price: true,
    shipping_cost: totalShippingCost,
    total_amount: totalAmount,
    commission_amount: commissionAmount,
    partner_amount: partnerAmount,
    shipping_address: shippingAddress,
    is_split_master: false,
    skip_stock_sync: false,
    payment_method: "mercadopago",
    payment_status: "pending",
    status: "pending",
    order_type: "product_purchase",
    created_at: new Date().toISOString(),
    partner_breakdown: {
      partners: itemsWithIVA.reduce((acc: any, item: any) => {
        if (!acc[item.partnerId]) {
          acc[item.partnerId] = { partner_id: item.partnerId, partner_name: item.partnerName, items: [], subtotal: 0 };
        }
        acc[item.partnerId].items.push({
          id: item.id, name: item.name, price: item.price, quantity: item.quantity,
          subtotal: item.subtotal, iva_amount: item.iva_amount, total: item.price * item.quantity,
        });
        acc[item.partnerId].subtotal += item.subtotal;
        return acc;
      }, {}),
      total_partners: 1,
      commission_split: commissionAmount,
      shipping_cost: totalShippingCost,
      iva_rate: partnerConfig.iva_rate,
      iva_amount: iva.ivaAmount,
      iva_included: true,
    },
  };

  const { data: insertedOrder, error: insertError } = await supabase
    .from("orders").insert([orderData]).select("id").single();
  if (insertError || !insertedOrder) throw new HttpError(500, `ORDER_CREATE_FAILED: ${insertError?.message}`);

  const orderId = insertedOrder.id;

  try {
    const rawPhone = cleanPhoneNumber(body.customerInfo?.phone);
    const addressParts = shippingAddress ? shippingAddress.split(",")[0] : "";
    const zipMatch = shippingAddress.match(/CP:\s*(\d+)/);
    const streetMatch = addressParts.match(/^(.+?)\s+(\d+)$/);

    const payer: any = {
      name: body.customerInfo?.displayName || "Cliente",
      email: body.customerInfo?.email || user.email,
      phone: { area_code: "598", number: rawPhone },
    };
    if (streetMatch) {
      payer.address = {
        street_name: streetMatch[1].trim(),
        street_number: parseInt(streetMatch[2], 10),
        zip_code: zipMatch ? zipMatch[1] : "",
      };
    } else if (addressParts.trim()) {
      payer.address = { street_name: addressParts.trim(), street_number: null, zip_code: zipMatch ? zipMatch[1] : "" };
    }

    const shippingItems = totalShippingCost > 0
      ? [{ id: "shipping", title: "Envío", quantity: 1, unit_price: totalShippingCost, currency_id: "UYU" }]
      : [];

    const preferenceData: any = {
      items: [
        ...cartItems.map((item) => ({ id: item.id, title: item.name, quantity: item.quantity, unit_price: item.price, currency_id: "UYU" })),
        ...shippingItems,
      ],
      payer,
      back_urls: {
        success: `dogcatify://payment/success?order_id=${orderId}&type=order`,
        failure: `dogcatify://payment/failure?order_id=${orderId}&type=order`,
        pending: `dogcatify://payment/pending?order_id=${orderId}&type=order`,
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: buildNotificationUrl(supabaseUrl),
      statement_descriptor: "DOGCATIFY",
      metadata: {
        order_type: "product_purchase", partner_name: partnerConfig.business_name,
        item_count: cartItems.length, shipping_cost: totalShippingCost,
        shipping_address: shippingAddress || null, total_amount: totalAmount,
      },
    };

    if (!partnerConfig.is_test_mode && partnerConfig.is_oauth && partnerConfig.mp_user_id && !isNaN(parseInt(String(partnerConfig.mp_user_id), 10))) {
      preferenceData.marketplace_fee = commissionAmount;
    }

    const preference = await fetchMercadoPago(partnerConfig.access_token, "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preferenceData),
    });

    const paymentUrl = partnerConfig.is_test_mode ? preference.sandbox_init_point : preference.init_point;
    if (!paymentUrl) throw new HttpError(502, "MERCADOPAGO_NO_PAYMENT_URL");

    await supabase.from("orders").update({
      payment_preference_id: preference.id,
      payment_status: "pending",
      last_payment_url: paymentUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", orderId);

    return { success: true, orderId, paymentUrl };
  } catch (preferenceError) {
    await supabase.from("orders").delete().eq("id", orderId);
    throw preferenceError;
  }
};

// ---------------------------------------------------------------------------
// action: service_booking — replaces createServiceBookingOrder + createServicePaymentPreference
// ---------------------------------------------------------------------------

const handleServiceBooking = async (supabase: any, supabaseUrl: string, user: any, body: any) => {
  const b = body.bookingData || {};
  const requiredFields = ["serviceId", "partnerId", "petId", "date", "time", "serviceName", "partnerName", "petName", "totalAmount"];
  for (const field of requiredFields) {
    if (b[field] === undefined || b[field] === null || b[field] === "") {
      throw new HttpError(400, `MISSING_FIELD_${field.toUpperCase()}`);
    }
  }

  const partnerConfig = await getPartnerPaymentConfig(supabase, b.partnerId);

  const { data: customerProfile } = await supabase
    .from("profiles")
    .select("display_name, email, phone, calle, numero, address_locality, barrio, codigo_postal")
    .eq("id", user.id)
    .maybeSingle();

  const customerInfo = {
    displayName: customerProfile?.display_name || b.customerInfo?.displayName || "Cliente",
    email: customerProfile?.email || user.email,
    phone: customerProfile?.phone || b.customerInfo?.phone,
    street: customerProfile?.calle,
    number: customerProfile?.numero,
    zipCode: customerProfile?.codigo_postal,
  };

  const { data: serviceData } = await supabase
    .from("partner_services")
    .select("iva_rate, currency, currency_code_dgi")
    .eq("id", b.serviceId)
    .maybeSingle();

  const ivaRate = serviceData?.iva_rate ?? partnerConfig.iva_rate ?? 0;
  const ivaIncluded = partnerConfig.iva_included_in_price !== false;
  const totalAmount = Number(b.totalAmount);

  let subtotal: number, ivaAmount: number;
  if (ivaIncluded) {
    subtotal = ivaRate > 0 ? totalAmount / (1 + ivaRate / 100) : totalAmount;
    ivaAmount = totalAmount - subtotal;
  } else {
    subtotal = totalAmount;
    ivaAmount = ivaRate > 0 ? subtotal * (ivaRate / 100) : 0;
  }

  const commissionAmount = totalAmount * (partnerConfig.commission_percentage / 100);
  const partnerAmount = totalAmount - commissionAmount;

  const bookingRecord = {
    service_id: b.serviceId, partner_id: b.partnerId, customer_id: user.id, pet_id: b.petId,
    date: new Date(b.date).toISOString(), time: b.time, status: "pending_payment", payment_status: "pending",
    notes: b.notes || null, total_amount: totalAmount, commission_amount: commissionAmount, partner_amount: partnerAmount,
    service_name: b.serviceName, partner_name: b.partnerName, pet_name: b.petName,
    payment_method: "mercadopago", created_at: new Date().toISOString(),
  };

  const { data: insertedBooking, error: bookingError } = await supabase
    .from("bookings").insert([bookingRecord]).select().single();
  if (bookingError || !insertedBooking) throw new HttpError(500, `BOOKING_CREATE_FAILED: ${bookingError?.message}`);

  const appointmentDate = new Date(b.date);
  appointmentDate.setUTCHours(0, 0, 0, 0);

  const orderData = {
    partner_id: b.partnerId, customer_id: user.id, booking_id: insertedBooking.id, service_id: b.serviceId, pet_id: b.petId,
    appointment_date: appointmentDate.toISOString(), appointment_time: b.time, booking_notes: b.notes || null,
    partner_name: b.partnerName, service_name: b.serviceName, pet_name: b.petName,
    customer_name: customerInfo.displayName, customer_email: customerInfo.email, customer_phone: customerInfo.phone || null,
    items: [{
      id: b.serviceId, name: b.serviceName, price: totalAmount, quantity: 1, type: "service",
      partnerId: b.partnerId, partnerName: b.partnerName, iva_rate: ivaRate, subtotal, iva_amount: ivaAmount,
      discount_percentage: b.discountPercentage ?? 0,
      discount_amount: Math.max(0, (b.originalPrice ?? totalAmount) - totalAmount),
      original_price: b.originalPrice ?? totalAmount,
      currency: serviceData?.currency || "UYU", currency_code_dgi: serviceData?.currency_code_dgi || "858",
    }],
    subtotal, iva_rate: ivaRate, iva_amount: ivaAmount, iva_included_in_price: ivaIncluded, total_amount: totalAmount,
    commission_amount: commissionAmount, partner_amount: partnerAmount, payment_method: "mercadopago",
    payment_status: "pending", payment_status_detail: null, payment_id: null, payment_data: null,
    status: "pending", order_type: "service_booking", created_at: new Date().toISOString(),
  };

  const { data: existingOrder } = await supabase.from("orders").select("id").eq("booking_id", insertedBooking.id).maybeSingle();

  let insertedOrder: any;
  if (existingOrder?.id) {
    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from("orders")
      .update({ ...orderData, payment_status: "pending", payment_status_detail: null, payment_id: null, payment_data: null, updated_at: new Date().toISOString() })
      .eq("id", existingOrder.id).select().single();
    if (updateOrderError || !updatedOrder) throw new HttpError(500, "ORDER_UPDATE_FAILED");
    insertedOrder = updatedOrder;
  } else {
    const { data: createdOrder, error: orderError } = await supabase.from("orders").insert([orderData]).select().single();
    if (orderError || !createdOrder) throw new HttpError(500, "ORDER_CREATE_FAILED");
    insertedOrder = createdOrder;
  }

  try {
    const phoneNumber = cleanPhoneNumber(customerInfo.phone);
    const payer: any = {
      name: customerInfo.displayName, email: customerInfo.email,
      phone: { area_code: "598", number: phoneNumber },
    };
    if (customerInfo.street && customerInfo.number) {
      payer.address = { street_name: customerInfo.street, street_number: parseInt(customerInfo.number, 10) || null, zip_code: customerInfo.zipCode || "" };
    }

    const preferenceData: any = {
      items: [{ id: b.serviceId, title: b.serviceName, quantity: 1, unit_price: totalAmount, currency_id: "UYU" }],
      payer,
      back_urls: {
        success: `dogcatify://payment/success?order_id=${insertedOrder.id}&type=booking`,
        failure: `dogcatify://payment/failure?order_id=${insertedOrder.id}&type=booking`,
        pending: `dogcatify://payment/pending?order_id=${insertedOrder.id}&type=booking`,
      },
      auto_return: "approved",
      external_reference: insertedOrder.id,
      notification_url: buildNotificationUrl(supabaseUrl),
      statement_descriptor: "DOGCATIFY",
      metadata: {
        order_type: "service_booking", service_name: b.serviceName, partner_name: b.partnerName, pet_name: b.petName,
        appointment_date: new Date(b.date).toISOString(), appointment_time: b.time,
      },
    };

    if (!partnerConfig.is_test_mode && partnerConfig.is_oauth && partnerConfig.mp_user_id && !isNaN(parseInt(String(partnerConfig.mp_user_id), 10))) {
      preferenceData.marketplace_fee = commissionAmount;
    }

    const preference = await fetchMercadoPago(partnerConfig.access_token, "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preferenceData),
    });

    const paymentUrl = partnerConfig.is_test_mode ? preference.sandbox_init_point : preference.init_point;
    if (!paymentUrl) throw new HttpError(502, "MERCADOPAGO_NO_PAYMENT_URL");

    await supabase.from("orders").update({ payment_preference_id: preference.id, updated_at: new Date().toISOString() }).eq("id", insertedOrder.id);

    return { success: true, orderId: insertedOrder.id, bookingId: insertedBooking.id, paymentUrl };
  } catch (preferenceError) {
    await supabase.from("orders").delete().eq("id", insertedOrder.id);
    await supabase.from("bookings").delete().eq("id", insertedBooking.id);
    throw preferenceError;
  }
};

// ---------------------------------------------------------------------------
// action: regenerate_link — replaces regeneratePaymentLink. Same "soft
// failure" contract as the original client function: never throws, always
// returns {success, paymentUrl?, error?}.
// ---------------------------------------------------------------------------

const handleRegenerateLink = async (supabase: any, supabaseUrl: string, user: any, body: any) => {
  const orderId = body.orderId;
  if (!orderId) return { success: false, error: "ORDER_ID_REQUIRED" };

  const { data: order, error: orderError } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (orderError || !order) return { success: false, error: "Orden no encontrada" };

  if (order.customer_id !== user.id) return { success: false, error: "No autorizado" };

  if (!["pending", "payment_failed"].includes(order.status)) {
    return { success: false, error: "Esta orden ya no puede ser pagada" };
  }

  if (order.order_type !== "service_booking") {
    return { success: false, error: "Regeneración de link para productos no implementada aún" };
  }

  try {
    const partnerConfig = await getPartnerPaymentConfig(supabase, order.partner_id);

    const preferenceData = {
      items: [{ id: order.service_id, title: order.service_name, quantity: 1, unit_price: order.total_amount, currency_id: "UYU" }],
      payer: {
        name: order.customer_name || "Cliente",
        email: order.customer_email,
        phone: { area_code: "598", number: cleanPhoneNumber(order.customer_phone) },
      },
      back_urls: {
        success: `dogcatify://payment/success?order_id=${orderId}&type=booking`,
        failure: `dogcatify://payment/failure?order_id=${orderId}&type=booking`,
        pending: `dogcatify://payment/pending?order_id=${orderId}&type=booking`,
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: buildNotificationUrl(supabaseUrl),
      statement_descriptor: "DOGCATIFY",
    };

    const preference = await fetchMercadoPago(partnerConfig.access_token, "/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preferenceData),
    });

    const paymentUrl = partnerConfig.is_test_mode ? preference.sandbox_init_point : preference.init_point;
    if (!paymentUrl) return { success: false, error: "No se pudo obtener la URL de pago" };

    await supabase.from("orders").update({
      payment_preference_id: preference.id,
      last_payment_url: paymentUrl,
      payment_link_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      payment_retry_count: (order.payment_retry_count || 0) + 1,
      status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", orderId);

    return { success: true, paymentUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error al crear preferencia de pago" };
  }
};

// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new HttpError(500, "SUPABASE_ENV_REQUIRED");

    const supabase = getSupabase();
    const user = await getAuthUser(supabase, req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // The caller must be the customer placing the order — never trust a
    // client-supplied customerId, always use the bearer token's own user.
    if (action === "product") {
      const result = await handleProductOrder(supabase, supabaseUrl, user, body);
      return jsonResponse(result);
    }

    if (action === "service_booking") {
      const result = await handleServiceBooking(supabase, supabaseUrl, user, body);
      return jsonResponse(result);
    }

    if (action === "regenerate_link") {
      const result = await handleRegenerateLink(supabase, supabaseUrl, user, body);
      return jsonResponse(result);
    }

    return jsonResponse({ success: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
    console.error("[create-order-payment] error", message);
    return jsonResponse({ success: false, error: message }, status);
  }
});
