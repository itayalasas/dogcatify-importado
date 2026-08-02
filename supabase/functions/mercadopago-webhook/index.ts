import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface WebhookNotification {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  application_id: number;
  user_id: number;
  version: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

type SubscriptionReferenceInfo = {
  scope: 'user' | 'partner';
  id: string;
  raw: string;
  prefix: string | null;
};

function getSubscriptionReferenceInfo(externalReference: string): SubscriptionReferenceInfo {
  const raw = String(externalReference || '').trim();

  if (!raw) {
    return { scope: 'user', id: '', raw: '', prefix: null };
  }

  const [prefixCandidate, ...rest] = raw.split(':');
  if (rest.length > 0) {
    const prefix = String(prefixCandidate || '').trim().toLowerCase();
    const id = rest.join(':').trim();

    if (prefix === 'partner' || prefix === 'user') {
      return {
        scope: prefix,
        id,
        raw,
        prefix,
      };
    }
  }

  return {
    scope: 'user',
    id: raw,
    raw,
    prefix: null,
  };
}

async function getMercadoPagoTokenCandidates(supabase: any): Promise<string[]> {
  const tokenCandidates: string[] = [];

  const { data: adminConfig } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'mercadopago_config')
    .maybeSingle();

  if (adminConfig?.value?.access_token) {
    tokenCandidates.push(adminConfig.value.access_token);
  }

  const { data: partners } = await supabase
    .from('partners')
    .select('mercadopago_config')
    .not('mercadopago_config', 'is', null);

  for (const partner of partners || []) {
    const token = partner?.mercadopago_config?.access_token;
    if (token && !tokenCandidates.includes(token)) {
      tokenCandidates.push(token);
    }
  }

  return tokenCandidates;
}

async function readJsonBody(req: Request): Promise<any> {
  try {
    const rawBody = await req.text();

    if (!rawBody.trim()) {
      return {};
    }

    return JSON.parse(rawBody);
  } catch (error) {
    return {};
  }
}

async function syncOrderPaymentByOrderId(supabase: any, orderId: string): Promise<boolean> {
  try {

    const tokenCandidates = await getMercadoPagoTokenCandidates(supabase);
    if (tokenCandidates.length === 0) {
      return false;
    }

    for (const token of tokenCandidates) {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${orderId}&sort=date_created&criteria=desc&limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        continue;
      }

      const searchData = await response.json();
      const results = searchData?.results || [];

      if (!results.length) {
        continue;
      }

      const approvedPayment = results.find((payment: any) => payment.status === 'approved');
      const selectedPayment = approvedPayment || results[0];

      if (!selectedPayment?.id) {
        continue;
      }


      await processPaymentNotification(supabase, {
        id: Number(selectedPayment.id),
        live_mode: true,
        type: 'payment',
        date_created: new Date().toISOString(),
        application_id: 0,
        user_id: 0,
        version: 1,
        api_version: 'v1',
        action: 'payment.updated',
        data: {
          id: String(selectedPayment.id)
        }
      } as WebhookNotification);

      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

async function verifyWebhookSignature(req: Request, notificationData: any): Promise<boolean> {
  try {
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    if (!xSignature || !xRequestId) {
      return false;
    }

    const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');

    if (!webhookSecret) {
      return true;
    }

    const parts = xSignature.split(',');
    let ts = '';
    let hash = '';

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();
        if (trimmedKey === 'ts') {
          ts = trimmedValue;
        } else if (trimmedKey === 'v1') {
          hash = trimmedValue;
        }
      }
    }

    if (!ts || !hash) {
      return false;
    }

    const url = new URL(req.url);
    const dataId = url.searchParams.get('data.id') ||
                   url.searchParams.get('id') ||
                   notificationData?.data?.id ||
                   '';

    if (!dataId) {
      const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
      if (!webhookSecret) {
        return true;
      }
      return false;
    }

    const signatureTemplate = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const secretKey = webhookSecret;


    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(signatureTemplate);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const isValid = computedHash === hash;

    if (!isValid) {
    } else {
    }

    return isValid;
  } catch (error) {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const urlParams = Object.fromEntries(url.searchParams.entries());


    const requestBody = await readJsonBody(req);

    if (requestBody?.order_id && !requestBody?.type) {
      const synced = await syncOrderPaymentByOrderId(supabase, String(requestBody.order_id));

      return new Response(
        JSON.stringify({ status: synced ? 'synced' : 'not_found' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const notification: WebhookNotification = requestBody;


    const paymentIdFromUrl = urlParams['id'] || urlParams['data.id'];
    const topicFromUrl = urlParams['topic'] || urlParams['type'];

    if (paymentIdFromUrl && topicFromUrl) {

      const normalizedNotification = {
        ...notification,
        type: topicFromUrl,
        action: notification.action || 'payment.updated',
        data: {
          id: paymentIdFromUrl
        },
        live_mode: notification.live_mode ?? !paymentIdFromUrl.startsWith('TEST'),
      };

      if (topicFromUrl === 'payment') {
        await processPaymentNotification(supabase, normalizedNotification as WebhookNotification);
      } else if (topicFromUrl === 'merchant_order') {
        await processMerchantOrderNotification(supabase, normalizedNotification as WebhookNotification);
      } else if (topicFromUrl === 'subscription_preapproval') {
        await processSubscriptionPreapprovalNotification(supabase, normalizedNotification as WebhookNotification);
      } else if (topicFromUrl === 'subscription_authorized_payment') {
        await processSubscriptionAuthorizedPaymentNotification(supabase, normalizedNotification as WebhookNotification);
      } else if (topicFromUrl === 'subscription_preapproval_plan') {
        await processSubscriptionPlanNotification(supabase, normalizedNotification as WebhookNotification);
      } else {
      }

      return new Response(
        JSON.stringify({ status: 'ok' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const isValid = await verifyWebhookSignature(req, notification);

    if (!isValid) {
      if (notification.data?.id || notification.type) {
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    } else {
    }


    if (notification.type === 'payment') {
      await processPaymentNotification(supabase, notification);
    } else if (notification.type === 'merchant_order') {
      await processMerchantOrderNotification(supabase, notification);
    } else if (notification.type === 'subscription_preapproval') {
      await processSubscriptionPreapprovalNotification(supabase, notification);
    } else if (notification.type === 'subscription_authorized_payment') {
      await processSubscriptionAuthorizedPaymentNotification(supabase, notification);
    } else if (notification.type === 'subscription_preapproval_plan') {
      await processSubscriptionPlanNotification(supabase, notification);
    } else {
    }

    return new Response(
      JSON.stringify({ status: 'ok' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

const cleanText = (value: unknown) => String(value || '').trim();

const isPickupFulfillment = (shippingAddress: string | null | undefined) =>
  /retiro/i.test(String(shippingAddress || ''));

const buildPartnerBusinessAddress = (partner: any) => {
  const directAddress = cleanText(partner?.business_address || partner?.address || partner?.location);
  if (directAddress) return directAddress;

  const street = cleanText(partner?.calle);
  const number = cleanText(partner?.numero);
  const neighborhood = cleanText(partner?.barrio);
  const zipCode = cleanText(partner?.codigo_postal);

  const streetLine = [street, number].filter(Boolean).join(' ').trim();
  const addressLine = [streetLine, neighborhood].filter(Boolean).join(', ').trim();

  if (zipCode) {
    return addressLine ? `${addressLine} - CP ${zipCode}` : `CP ${zipCode}`;
  }

  return addressLine;
};

const buildPickupAddress = (partner: any, fallbackName?: string | null) => {
  const businessName = cleanText(partner?.business_name || fallbackName);
  const businessAddress = buildPartnerBusinessAddress(partner);
  const addressParts = [businessName, businessAddress].filter(Boolean).join(' - ').trim();

  return addressParts ? `Retiro en tienda: ${addressParts}` : 'Retiro en tienda';
};

const getSplitPartnerIds = (orderData: any) => {
  const partnerIds = new Set<string>();
  const breakdownPartners = orderData?.partner_breakdown?.partners || {};

  Object.keys(breakdownPartners).forEach((partnerId) => {
    const cleanPartnerId = cleanText(partnerId);
    if (cleanPartnerId) partnerIds.add(cleanPartnerId);
  });

  if (Array.isArray(orderData?.items)) {
    orderData.items.forEach((item: any) => {
      const partnerId = cleanText(item?.partnerId || item?.partner_id);
      if (partnerId) partnerIds.add(partnerId);
    });
  }

  if (partnerIds.size === 0 && orderData?.partner_id) {
    partnerIds.add(cleanText(orderData.partner_id));
  }

  return Array.from(partnerIds);
};

const buildSplitChildItems = (orderData: any, partnerId: string, breakdownPartner: any) => {
  const sourceItems = Array.isArray(breakdownPartner?.items) && breakdownPartner.items.length > 0
    ? breakdownPartner.items
    : (Array.isArray(orderData?.items)
        ? orderData.items.filter((item: any) =>
            cleanText(item?.partnerId || item?.partner_id) === partnerId
          )
        : []);

  return sourceItems.map((item: any) => ({
    ...item,
    partnerId,
    partner_id: partnerId,
    partner_name: cleanText(breakdownPartner?.partner_name || item?.partner_name || item?.partnerName || orderData?.partner_name || ''),
  }));
};

const buildSplitChildPartnerBreakdown = (
  partnerId: string,
  partnerName: string,
  partnerAddress: string,
  items: any[],
  subtotal: number,
  commissionAmount: number,
  shippingCost: number,
  ivaAmount: number,
  ivaRate: number,
  ivaIncluded: boolean,
) => ({
  partners: {
    [partnerId]: {
      partner_id: partnerId,
      partner_name: partnerName,
      partner_address: partnerAddress,
      items,
      subtotal,
    },
  },
  total_partners: 1,
  commission_split: commissionAmount,
  shipping_cost: shippingCost,
  iva_rate: ivaRate,
  iva_amount: ivaAmount,
  iva_included: ivaIncluded,
});

const createSplitChildOrders = async (
  supabase: any,
  masterOrder: any,
  paymentData: any,
  paymentStatus: string,
  statusDetail: string,
  orderStatus: string,
) => {
  if (masterOrder?.order_type !== 'product_purchase') {
    return { createdCount: 0, totalCount: 0 };
  }

  const partnerIds = getSplitPartnerIds(masterOrder);
  if (partnerIds.length <= 1) {
    return { createdCount: 0, totalCount: partnerIds.length };
  }

  const { data: existingChildren, error: existingChildrenError } = await supabase
    .from('orders')
    .select('id, partner_id')
    .eq('parent_order_id', masterOrder.id);

  if (existingChildrenError) {
  }

  const existingPartnerIds = new Set(
    (existingChildren || [])
      .map((row: any) => cleanText(row?.partner_id))
      .filter(Boolean),
  );

  const { data: partnersData, error: partnersError } = await supabase
    .from('partners')
    .select('id, business_name, email, phone, address, location, calle, numero, barrio, codigo_postal, commission_percentage')
    .in('id', partnerIds);

  if (partnersError) {
    throw partnersError;
  }

  const partnersMap = new Map((partnersData || []).map((partner: any) => [partner.id, partner]));
  const breakdownPartners = masterOrder?.partner_breakdown?.partners || {};
  const groupData: any[] = partnerIds.map((partnerId) => {
    const breakdownPartner = (breakdownPartners[partnerId] || {}) as any;
    const partnerInfo = (partnersMap.get(partnerId) || {}) as any;
    const items = buildSplitChildItems(masterOrder, partnerId, breakdownPartner);
    const subtotal = roundMoney(
      Number.isFinite(Number(breakdownPartner?.subtotal))
        ? Number(breakdownPartner.subtotal)
        : items.reduce((sum: number, item: any) => sum + Number(item?.subtotal || 0), 0),
    );
    const grossTotal = roundMoney(items.reduce((sum: number, item: any) => {
      const itemTotal = Number(item?.total);
      if (Number.isFinite(itemTotal)) return sum + itemTotal;

      const price = Number(item?.price || 0);
      const quantity = Number(item?.quantity || 1);
      return sum + (price * quantity);
    }, 0));
    const ivaAmount = roundMoney(items.reduce((sum: number, item: any) => sum + Number(item?.iva_amount || 0), 0) || (grossTotal - subtotal));
    const partnerName = cleanText(partnerInfo?.business_name || breakdownPartner?.partner_name || masterOrder?.partner_name || 'Tienda');
    const partnerAddress = buildPartnerBusinessAddress(partnerInfo);
    const commissionPercentage = Number(partnerInfo?.commission_percentage ?? masterOrder?.commission_percentage ?? 5);

    return {
      partnerId,
      partnerName,
      partnerAddress,
      partnerInfo,
      items,
      subtotal,
      grossTotal,
      ivaAmount,
      commissionPercentage,
      isExisting: existingPartnerIds.has(partnerId),
    };
  });

  const totalShippingCost = roundMoney(Number(masterOrder?.shipping_cost || 0));
  const totalGross = roundMoney(groupData.reduce((sum: number, group: any) => sum + group.grossTotal, 0));
  let shippingRemainder = totalShippingCost;

  groupData.forEach((group: any, index: number) => {
    if (groupData.length === 0) {
      group.shippingShare = 0;
      return;
    }

    if (index === groupData.length - 1) {
      group.shippingShare = roundMoney(shippingRemainder);
      return;
    }

    const baseShare = totalShippingCost > 0
      ? (totalGross > 0
        ? totalShippingCost * (group.grossTotal / totalGross)
        : totalShippingCost / groupData.length)
      : 0;
    group.shippingShare = roundMoney(baseShare);
    shippingRemainder = roundMoney(shippingRemainder - group.shippingShare);
  });

  let createdCount = 0;
  const now = new Date().toISOString();
  const masterShippingIsPickup = isPickupFulfillment(masterOrder?.shipping_address);

  for (const group of groupData) {
    if (group.isExisting) {
      continue;
    }

    const childCommissionAmount = roundMoney((group.subtotal * group.commissionPercentage) / 100);
    const childPartnerAmount = roundMoney(group.subtotal - childCommissionAmount);
    const childShippingAddress = masterShippingIsPickup
      ? buildPickupAddress(group.partnerInfo, group.partnerName)
      : String(masterOrder?.shipping_address || '').trim() || null;
    const childItems = group.items;
    const childPartnerBreakdown = buildSplitChildPartnerBreakdown(
      group.partnerId,
      group.partnerName,
      group.partnerAddress,
      childItems,
      group.subtotal,
      childCommissionAmount,
      group.shippingShare,
      group.ivaAmount,
      Number(masterOrder?.iva_rate || 0),
      Boolean(masterOrder?.iva_included_in_price),
    );

    const childOrderData = {
      partner_id: group.partnerId,
      customer_id: masterOrder.customer_id,
      items: childItems,
      status: orderStatus,
      total_amount: roundMoney(group.subtotal + group.ivaAmount + group.shippingShare),
      shipping_address: childShippingAddress,
      created_at: now,
      updated_at: now,
      payment_preference_id: masterOrder.payment_preference_id || null,
      payment_id: paymentData?.id || masterOrder.payment_id || null,
      payment_method: masterOrder.payment_method || 'mercadopago',
      payment_status: paymentStatus,
      payment_data: paymentData,
      commission_amount: childCommissionAmount,
      partner_amount: childPartnerAmount,
      partner_breakdown: childPartnerBreakdown,
      booking_id: masterOrder.booking_id || null,
      order_type: masterOrder.order_type || 'product_purchase',
      service_id: masterOrder.service_id || null,
      appointment_date: masterOrder.appointment_date || null,
      appointment_time: masterOrder.appointment_time || null,
      pet_id: masterOrder.pet_id || null,
      booking_notes: masterOrder.booking_notes || null,
      subtotal: group.subtotal,
      iva_rate: masterOrder.iva_rate || 0,
      iva_amount: group.ivaAmount,
      iva_included_in_price: masterOrder.iva_included_in_price || false,
      partner_name: group.partnerName,
      service_name: masterOrder.service_name || null,
      pet_name: masterOrder.pet_name || null,
      customer_name: masterOrder.customer_name || null,
      customer_email: masterOrder.customer_email || null,
      customer_phone: masterOrder.customer_phone || null,
      shipping_cost: group.shippingShare,
      payment_link_expires_at: masterOrder.payment_link_expires_at || null,
      payment_retry_count: masterOrder.payment_retry_count || 0,
      last_payment_url: masterOrder.last_payment_url || null,
      payment_status_detail: paymentData?.status_detail || statusDetail || null,
      parent_order_id: masterOrder.id,
      is_split_master: false,
      skip_stock_sync: !Boolean(masterOrder?.skip_stock_sync),
    };

    const { data: insertedChild, error: insertChildError } = await supabase
      .from('orders')
      .insert(childOrderData)
      .select('id')
      .single();

    if (insertChildError) {
      if (insertChildError.code === '23505') {
        continue;
      }

      throw insertChildError;
    }

    createdCount += 1;
  }

  return {
    createdCount,
    totalCount: groupData.length,
  };
};

async function processPaymentNotification(supabase: any, notification: WebhookNotification) {
  try {
    const paymentId = notification.data.id;

    const { data: adminConfig, error: adminError } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .maybeSingle();

    let paymentData: any = null;
    let accessToken = '';

    if (adminConfig?.value?.access_token) {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${adminConfig.value.access_token}`,
          'Content-Type': 'application/json'
        },
      });

      if (mpResponse.ok) {
        paymentData = await mpResponse.json();
        accessToken = adminConfig.value.access_token;
      } else {
      }
    }

    let mpApiUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
    let mpResponse: any;

    if (!paymentData) {

      const { data: partners, error: partnersError } = await supabase
        .from('partners')
        .select('id, business_name, mercadopago_config')
        .not('mercadopago_config', 'is', null);

      if (partners && partners.length > 0) {

        for (const partner of partners) {
          const partnerToken = partner.mercadopago_config?.access_token;
          if (!partnerToken) continue;


          const testResponse = await fetch(mpApiUrl, {
            headers: {
              'Authorization': `Bearer ${partnerToken}`,
              'Content-Type': 'application/json'
            },
          });

          if (testResponse.ok) {
            paymentData = await testResponse.json();
            accessToken = partnerToken;
            break;
          } else {
          }
        }
      }
    } else if (paymentData?.external_reference) {
      const orderId = paymentData.external_reference;

      const { data: orderData } = await supabase
        .from('orders')
        .select('*, partners!inner(mercadopago_config)')
        .eq('id', orderId)
        .maybeSingle();

      if (orderData?.partners?.mercadopago_config?.access_token) {
        accessToken = orderData.partners.mercadopago_config.access_token;
      }
    }

    if (!paymentData) {

      if (!accessToken) {
        return;
      }


      mpResponse = await fetch(mpApiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
      });

      if (!mpResponse.ok) {
        const errorText = await mpResponse.text();

        if (mpResponse.status === 404) {
        } else if (mpResponse.status === 401) {
        }

        return;
      }

      paymentData = await mpResponse.json();
    }

    if (!paymentData) {
      return;
    }


    let orderId = paymentData.external_reference;

    if (!orderId) {
      return;
    }


    // Verificar si el orderId es un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(orderId)) {

      // Intentar buscar la orden usando el preference_id del payment
      const preferenceId = paymentData.metadata?.preference_id || paymentData.order?.id;


      if (!preferenceId) {
        return;
      }

      const { data: orderByPref, error: prefError } = await supabase
        .from('orders')
        .select('*, partners!inner(mercadopago_config)')
        .eq('payment_preference_id', preferenceId)
        .maybeSingle();

      if (orderByPref) {
        orderId = orderByPref.id;
      } else {
        return;
      }
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, partners!inner(mercadopago_config)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !orderData) {
      return;
    }


    const paymentStatus = paymentData.status;
    const statusDetail = paymentData.status_detail;
    const orderStatus = mapPaymentStatusToOrderStatus(paymentStatus);
    const isSplitMasterOrder = Boolean(orderData.is_split_master)
      || Number(orderData?.partner_breakdown?.total_partners || 0) > 1
      || Object.keys(orderData?.partner_breakdown?.partners || {}).length > 1;


    const isApproved = paymentStatus === 'approved';
    const isAccredited = statusDetail === 'accredited';

    const totalAmount = paymentData.transaction_amount;
    const commissionAmount = orderData.commission_amount || (totalAmount * 0.05);
    const partnerAmount = totalAmount - commissionAmount;



    const updateData: any = {
      status: orderStatus,
      payment_id: paymentId,
      payment_status: paymentStatus,
      payment_status_detail: statusDetail,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      payment_data: paymentData,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      return;
    }


    if (isApproved) {

      if (isSplitMasterOrder) {
        const splitResult = await createSplitChildOrders(
          supabase,
          orderData,
          paymentData,
          paymentStatus,
          statusDetail,
          orderStatus,
        );

      }

      await updateProductStock(supabase, orderId);

      if (orderData.order_type === 'service_booking' && orderData.booking_id) {
        await updateBookingStatus(supabase, orderData.booking_id, 'confirmed', paymentId);
      }

      if (isSplitMasterOrder) {
        return;
      }

      // Fallback robusto: disparar envío contable explícitamente al confirmar pago
      // (evita pérdida de envíos si el trigger de BD falla en algún escenario)
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
        } else {
          const accountingResponse = await fetch(`${supabaseUrl}/functions/v1/send-order-to-accounting`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ order_id: orderId }),
          });

          const accountingBody = await accountingResponse.text();
        }
      } catch (accountingError) {
      }

    } else {
    }

  } catch (error) {
    throw error;
  }
}

async function processMerchantOrderNotification(supabase: any, notification: WebhookNotification) {
  try {
    const merchantOrderId = notification.data?.id;

    if (!merchantOrderId) {
      return;
    }

    const { data: adminConfig } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .maybeSingle();

    const tokenCandidates: string[] = [];

    if (adminConfig?.value?.access_token) {
      tokenCandidates.push(adminConfig.value.access_token);
    }

    const { data: partners } = await supabase
      .from('partners')
      .select('mercadopago_config')
      .not('mercadopago_config', 'is', null);

    for (const partner of partners || []) {
      const token = partner?.mercadopago_config?.access_token;
      if (token && !tokenCandidates.includes(token)) {
        tokenCandidates.push(token);
      }
    }

    if (tokenCandidates.length === 0) {
      return;
    }

    let merchantOrderData: any = null;
    for (const token of tokenCandidates) {
      const response = await fetch(`https://api.mercadopago.com/merchant_orders/${merchantOrderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      if (response.ok) {
        merchantOrderData = await response.json();
        break;
      }
    }

    if (!merchantOrderData) {
      return;
    }

    const payments = merchantOrderData.payments || [];
    if (payments.length === 0) {
      return;
    }

    const approvedPayment = payments.find((payment: any) => payment.status === 'approved');
    const selectedPayment = approvedPayment || payments[0];

    if (!selectedPayment?.id) {
      return;
    }


    await processPaymentNotification(supabase, {
      ...notification,
      type: 'payment',
      action: 'payment.updated',
      data: {
        id: String(selectedPayment.id)
      }
    } as WebhookNotification);
  } catch (error) {
    throw error;
  }
}

async function fetchMercadoPagoResource(supabase: any, path: string): Promise<any | null> {
  const tokenCandidates = await getMercadoPagoTokenCandidates(supabase);

  for (const token of tokenCandidates) {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    });

    if (response.ok) {
      return await response.json();
    }

    const errorText = await response.text();
  }

  return null;
}

function mapPreapprovalStatusToLocalStatus(mpStatus: string): string {
  switch (String(mpStatus || '').toLowerCase()) {
    case 'authorized':
    case 'active':
      return 'active';
    case 'paused':
      return 'paused';
    case 'cancelled':
    case 'canceled':
    case 'rejected':
      return 'cancelled';
    case 'pending':
    default:
      return 'pending';
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getPreapprovalPayerEmail(preapproval: any): string | null {
  const email =
    preapproval?.payer_email ||
    preapproval?.payer?.email ||
    preapproval?.subscriber?.email ||
    null;

  return email ? String(email).trim().toLowerCase() : null;
}

function isValidDate(value?: string | null): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function addDays(date: string | Date, days: number): string {
  const base = typeof date === 'string' ? new Date(date) : new Date(date);
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

async function hasUsedUserTrial(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('trial_used', true)
    .limit(1);

  if (error) {
    throw new Error(`USER_TRIAL_LOOKUP_FAILED: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

async function findPlanByMercadoPagoPlanId(supabase: any, mpPlanId: string): Promise<any | null> {
  if (!mpPlanId) return null;

  const { data: monthlyPlan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('mercadopago_monthly_plan_id', mpPlanId)
    .maybeSingle();

  if (monthlyPlan) {
    return {
      ...monthlyPlan,
      detected_billing_cycle: 'monthly',
    };
  }

  const { data: yearlyPlan } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('mercadopago_yearly_plan_id', mpPlanId)
    .maybeSingle();

  if (yearlyPlan) {
    return {
      ...yearlyPlan,
      detected_billing_cycle: 'yearly',
    };
  }

  return null;
}

function getBillingCycleFromPreapproval(preapproval: any, localPlan?: any): string {
  if (localPlan?.detected_billing_cycle) {
    return localPlan.detected_billing_cycle;
  }

  const frequency = Number(preapproval?.auto_recurring?.frequency || 1);
  const frequencyType = String(preapproval?.auto_recurring?.frequency_type || 'months').toLowerCase();

  if (frequencyType === 'months' && frequency >= 12) {
    return 'yearly';
  }

  return 'monthly';
}

async function findOrCreateLocalSubscriptionForPreapproval(supabase: any, preapproval: any): Promise<any | null> {
  const preapprovalId = String(preapproval?.id || '');
  const externalReference = String(preapproval?.external_reference || '');
  const mpPlanId = String(preapproval?.preapproval_plan_id || '');
  const referenceInfo = getSubscriptionReferenceInfo(externalReference);


  if (referenceInfo.scope === 'partner') {
    return null;
  }

  if (referenceInfo.id && isUuid(referenceInfo.id)) {
    const { data: byExternalReference } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', referenceInfo.id)
    .maybeSingle();

    if (byExternalReference) {
      return byExternalReference;
    }
  }

  if (preapprovalId) {
    const { data: byPreapprovalId } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('mercadopago_preapproval_id', preapprovalId)
    .maybeSingle();

    if (byPreapprovalId) {
      return byPreapprovalId;
    }
  }

  const payerEmail = getPreapprovalPayerEmail(preapproval);
  if (!payerEmail || !mpPlanId) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .ilike('email', payerEmail)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const localPlan = await findPlanByMercadoPagoPlanId(supabase, mpPlanId);
  if (!localPlan) {
    return null;
  }

  const { data: pendingSubscription } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('mercadopago_preapproval_plan_id', mpPlanId)
    .in('status', ['pending', 'trialing', 'active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingSubscription) {
    return pendingSubscription;
  }

  const now = new Date().toISOString();
  const trialDays = Math.max(0, Math.trunc(Number(localPlan.trial_days || 0)));
  const trialAlreadyUsed = await hasUsedUserTrial(supabase, profile.id);
  const canGrantTrial = trialDays > 0 && !trialAlreadyUsed;
  const { data: createdSubscription, error: createError } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: profile.id,
      plan_id: localPlan.id,
      status: canGrantTrial ? 'trialing' : 'pending',
      billing_cycle: getBillingCycleFromPreapproval(preapproval, localPlan),
      trial_days: trialDays,
      trial_started_at: canGrantTrial ? now : null,
      trial_ends_at: canGrantTrial ? addDays(now, trialDays) : null,
      trial_used: canGrantTrial,
      mercadopago_preapproval_id: preapprovalId || null,
      mercadopago_preapproval_plan_id: mpPlanId,
      mercadopago_status: preapproval?.status || 'pending',
      payment_url: preapproval?.init_point || null,
      metadata: {
        source: 'mercadopago_webhook',
        payer_email: payerEmail,
        created_from_webhook: true,
        trial_days: trialDays,
        trial_granted: canGrantTrial,
      },
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (createError) {
    return null;
  }


  return createdSubscription;
}

async function findOrCreateLocalPartnerSubscriptionForPreapproval(supabase: any, preapproval: any): Promise<any | null> {
  const preapprovalId = String(preapproval?.id || '');
  const externalReference = String(preapproval?.external_reference || '');
  const referenceInfo = getSubscriptionReferenceInfo(externalReference);


  if (referenceInfo.scope !== 'partner') {
    return null;
  }

  if (referenceInfo.id && isUuid(referenceInfo.id)) {
    const { data: byExternalReference } = await supabase
      .from('partner_subscriptions')
      .select('*')
      .eq('id', referenceInfo.id)
    .maybeSingle();

    if (byExternalReference) {
      return byExternalReference;
    }
  }

  if (preapprovalId) {
    const { data: byPreapprovalId } = await supabase
      .from('partner_subscriptions')
      .select('*')
      .eq('mercadopago_preapproval_id', preapprovalId)
    .maybeSingle();

    if (byPreapprovalId) {
      return byPreapprovalId;
    }
  }

  return null;
}

async function processSubscriptionPreapprovalNotification(supabase: any, notification: WebhookNotification) {
  const preapprovalId = notification.data?.id;

  if (!preapprovalId) {
    return;
  }


  let preapproval = await fetchMercadoPagoResource(supabase, `/preapproval/${preapprovalId}`);

  if (!preapproval) {
    const search = await fetchMercadoPagoResource(
      supabase,
      `/preapproval/search?id=${encodeURIComponent(preapprovalId)}`
    );
    preapproval = search?.results?.[0] || null;
  }

  if (!preapproval) {
    return;
  }

  const referenceInfo = getSubscriptionReferenceInfo(String(preapproval.external_reference || ''));
  const localSubscription = referenceInfo.scope === 'partner'
    ? await findOrCreateLocalPartnerSubscriptionForPreapproval(supabase, preapproval)
    : await findOrCreateLocalSubscriptionForPreapproval(supabase, preapproval);
  if (!localSubscription) {
    return;
  }

  const now = new Date().toISOString();
  const localStatus = mapPreapprovalStatusToLocalStatus(preapproval.status);

  if (referenceInfo.scope === 'partner') {
    const trialEndsAt = isValidDate(String(localSubscription.trial_ends_at || '')) ? String(localSubscription.trial_ends_at) : null;
    const effectiveStatus = localSubscription.trial_used && trialEndsAt && new Date(trialEndsAt).getTime() > Date.now() && localStatus === 'active'
      ? 'trialing'
      : localStatus;


    const metadata = {
      ...(localSubscription.metadata || {}),
      mp_preapproval: preapproval,
      last_webhook: {
        type: notification.type,
        action: notification.action,
        received_at: now,
      },
    };

    const updatePayload: any = {
      status: effectiveStatus,
      crm_subscription_id: preapproval.id,
      mercadopago_preapproval_id: preapproval.id,
      mercadopago_preapproval_plan_id: preapproval.preapproval_plan_id || localSubscription.mercadopago_preapproval_plan_id,
      mercadopago_status: preapproval.status,
      payment_url: preapproval.init_point || localSubscription.payment_url,
      billing_cycle: localSubscription.billing_cycle,
      metadata,
      last_synced_at: now,
      updated_at: now,
    };

    if (!localSubscription.started_at) {
      updatePayload.started_at = preapproval.date_created || now;
    }

    if (preapproval.next_payment_date) {
      updatePayload.expires_at = preapproval.next_payment_date;
    } else if (trialEndsAt) {
      updatePayload.expires_at = trialEndsAt;
    }

    const { error: updateError } = await supabase
      .from('partner_subscriptions')
      .update(updatePayload)
      .eq('id', localSubscription.id);

    if (updateError) {
      return;
    }

    const partnerId = String(localSubscription.partner_id || '');
    const planTier = String(localSubscription.metadata?.plan_tier || 'starter');
    const { data: partnerForUpdate, error: partnerLookupError } = await supabase
      .from('partners')
      .select('user_id')
      .eq('id', partnerId)
      .maybeSingle();

    if (partnerLookupError) {
    }

    const partnerUserId = partnerForUpdate?.user_id || null;
    const { error: partnerUpdateError } = partnerUserId
      ? await supabase
        .from('partners')
        .update({
          subscription_plan_tier: planTier,
          subscription_plan_status: effectiveStatus,
          subscription_plan_started_at: preapproval.date_created || now,
          subscription_plan_expires_at: preapproval.next_payment_date || trialEndsAt || null,
          subscription_plan_metadata: {
            ...(localSubscription.metadata || {}),
            mp_preapproval: preapproval,
            last_webhook: {
              type: notification.type,
              action: notification.action,
              received_at: now,
            },
          },
          updated_at: now,
        })
        .eq('user_id', partnerUserId)
      : { error: null };

    if (partnerUpdateError) {
    }

    return;
  }

  const metadata = {
    ...(localSubscription.metadata || {}),
    mp_preapproval: preapproval,
    last_webhook: {
      type: notification.type,
      action: notification.action,
    received_at: now,
    },
  };

  const trialEndsAt = isValidDate(String(localSubscription.trial_ends_at || '')) ? String(localSubscription.trial_ends_at) : null;
  const effectiveStatus = localSubscription.trial_used && trialEndsAt && new Date(trialEndsAt).getTime() > Date.now() && localStatus === 'active'
    ? 'trialing'
    : localStatus;


  const updatePayload: any = {
    status: effectiveStatus,
    crm_subscription_id: preapproval.id,
    mercadopago_preapproval_id: preapproval.id,
    mercadopago_preapproval_plan_id: preapproval.preapproval_plan_id || localSubscription.mercadopago_preapproval_plan_id,
    mercadopago_status: preapproval.status,
    payment_url: preapproval.init_point || localSubscription.payment_url,
    billing_cycle: localSubscription.billing_cycle || getBillingCycleFromPreapproval(preapproval),
    metadata,
    last_synced_at: now,
    updated_at: now,
  };

  if (effectiveStatus === 'trialing' && !localSubscription.started_at) {
    updatePayload.started_at = localSubscription.trial_started_at || preapproval.date_created || now;
  } else if (localStatus === 'active' && !localSubscription.started_at) {
    updatePayload.started_at = preapproval.date_created || now;
  }

  if (preapproval.next_payment_date) {
    updatePayload.expires_at = preapproval.next_payment_date;
  } else if (trialEndsAt) {
    updatePayload.expires_at = trialEndsAt;
  }

  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update(updatePayload)
    .eq('id', localSubscription.id);

  if (updateError) {
    return;
  }

}

async function processSubscriptionAuthorizedPaymentNotification(supabase: any, notification: WebhookNotification) {
  const authorizedPaymentId = notification.data?.id;

  if (!authorizedPaymentId) {
    return;
  }


  const authorizedPayment = await fetchMercadoPagoResource(
    supabase,
    `/authorized_payments/${authorizedPaymentId}`
  );

  if (!authorizedPayment) {
    return;
  }

  const preapprovalId =
    authorizedPayment.preapproval_id ||
    authorizedPayment.subscription_id ||
    authorizedPayment.preapproval?.id ||
    authorizedPayment.external_reference;

  if (preapprovalId) {

    await processSubscriptionPreapprovalNotification(supabase, {
      ...notification,
      type: 'subscription_preapproval',
      action: 'subscription.updated',
      data: {
        id: String(preapprovalId),
      },
    } as WebhookNotification);
  }

  const { data: userSubscription } = preapprovalId
    ? await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('mercadopago_preapproval_id', String(preapprovalId))
      .maybeSingle()
    : { data: null };

  const { data: partnerSubscription } = preapprovalId
    ? await supabase
      .from('partner_subscriptions')
      .select('*')
      .eq('mercadopago_preapproval_id', String(preapprovalId))
      .maybeSingle()
    : { data: null };

  const localSubscription = partnerSubscription || userSubscription;

  if (!localSubscription) {
    return;
  }

  const now = new Date().toISOString();
  const metadata = {
    ...(localSubscription.metadata || {}),
    last_authorized_payment: authorizedPayment,
    last_webhook: {
      type: notification.type,
      action: notification.action,
      received_at: now,
    },
  };

  const trialEndsAt = isValidDate(String(localSubscription.trial_ends_at || '')) ? String(localSubscription.trial_ends_at) : null;
  const effectiveStatus = localSubscription.trial_used && trialEndsAt && new Date(trialEndsAt).getTime() > Date.now()
    ? 'trialing'
    : 'active';

  const updatePayload = {
    status: effectiveStatus,
    metadata,
    last_synced_at: now,
    updated_at: now,
  };

  const { error: updateError } = partnerSubscription
    ? await supabase
      .from('partner_subscriptions')
      .update(updatePayload)
      .eq('id', localSubscription.id)
    : await supabase
      .from('user_subscriptions')
      .update(updatePayload)
      .eq('id', localSubscription.id);

  if (updateError) {
    return;
  }

}

async function processSubscriptionPlanNotification(supabase: any, notification: WebhookNotification) {
  const mpPlanId = notification.data?.id;

  if (!mpPlanId) {
    return;
  }


  const mpPlan = await fetchMercadoPagoResource(supabase, `/preapproval_plan/${mpPlanId}`);
  if (!mpPlan) {
    return;
  }

  let localPlan = await findPlanByMercadoPagoPlanId(supabase, mpPlanId);

  if (!localPlan && mpPlan.external_reference) {
    const [localPlanId, cycle] = String(mpPlan.external_reference).split(':');
    if (isUuid(localPlanId)) {
      const { data: planByReference } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', localPlanId)
        .maybeSingle();

      if (planByReference) {
        localPlan = {
          ...planByReference,
          detected_billing_cycle: cycle === 'yearly' ? 'yearly' : 'monthly',
        };
      }
    }
  }

  if (!localPlan) {
    return;
  }

  const cycle = localPlan.detected_billing_cycle === 'yearly' ? 'yearly' : 'monthly';
  const priceField = cycle === 'yearly' ? 'price_yearly' : 'price_monthly';
  const idField = cycle === 'yearly' ? 'mercadopago_yearly_plan_id' : 'mercadopago_monthly_plan_id';
  const initPointField = cycle === 'yearly' ? 'mercadopago_yearly_init_point' : 'mercadopago_monthly_init_point';
  const statusField = cycle === 'yearly' ? 'mercadopago_yearly_status' : 'mercadopago_monthly_status';
  const now = new Date().toISOString();
  const amount = Number(mpPlan?.auto_recurring?.transaction_amount);

  const updates: any = {
    [idField]: mpPlan.id,
    [initPointField]: mpPlan.init_point || null,
    [statusField]: mpPlan.status || null,
    mercadopago_last_sync_at: now,
    mercadopago_sync_error: null,
    mercadopago_metadata: {
      ...(localPlan.mercadopago_metadata || {}),
      [cycle]: {
        id: mpPlan.id,
        status: mpPlan.status,
        reason: mpPlan.reason,
        init_point: mpPlan.init_point,
        auto_recurring: mpPlan.auto_recurring,
        last_modified: mpPlan.last_modified,
      },
      last_plan_webhook_at: now,
    },
    updated_at: now,
  };

  if (Number.isFinite(amount) && amount > 0) {
    updates[priceField] = amount;
  }

  if (mpPlan?.auto_recurring?.currency_id) {
    updates.currency = String(mpPlan.auto_recurring.currency_id).toUpperCase();
  }

  const { error: updateError } = await supabase
    .from('subscription_plans')
    .update(updates)
    .eq('id', localPlan.id);

  if (updateError) {
  }
}

function mapPaymentStatusToOrderStatus(mpStatus: string): string {
  switch (mpStatus) {
    case 'approved':
      return 'confirmed';
    case 'pending':
      return 'pending';
    case 'in_process':
      return 'processing';
    case 'rejected':
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
}

async function updateProductStock(supabase: any, orderId: string) {
  void supabase;
}

async function updateBookingStatus(supabase: any, bookingId: string, status: string, paymentId: string) {
  void supabase;
  void status;
  void paymentId;
}

