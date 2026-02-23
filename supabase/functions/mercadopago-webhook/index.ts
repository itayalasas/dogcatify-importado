import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function syncOrderPaymentByOrderId(supabase: any, orderId: string): Promise<boolean> {
  try {
    console.log(`🔄 Manual payment sync requested for order: ${orderId}`);

    const tokenCandidates = await getMercadoPagoTokenCandidates(supabase);
    if (tokenCandidates.length === 0) {
      console.error('❌ No Mercado Pago access tokens available for manual sync');
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

      const approvedAccredited = results.find((payment: any) => payment.status === 'approved' && payment.status_detail === 'accredited');
      const selectedPayment = approvedAccredited || results[0];

      if (!selectedPayment?.id) {
        continue;
      }

      console.log(`✅ Found payment ${selectedPayment.id} for order ${orderId}, processing...`);

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

    console.warn(`⚠️ No payments found in MP for order ${orderId}`);
    return false;
  } catch (error) {
    console.error('❌ Error syncing order payment by order_id:', error);
    return false;
  }
}

async function verifyWebhookSignature(req: Request, notificationData: any): Promise<boolean> {
  try {
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    if (!xSignature || !xRequestId) {
      console.warn('Missing signature headers');
      return false;
    }

    const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.warn('MERCADOPAGO_WEBHOOK_SECRET not configured, skipping validation');
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
      console.error('Invalid signature format');
      return false;
    }

    const url = new URL(req.url);
    const dataId = url.searchParams.get('data.id') ||
                   url.searchParams.get('id') ||
                   notificationData?.data?.id ||
                   '';

    if (!dataId) {
      console.error('Missing data.id for signature validation');
      console.error('URL search params:', Object.fromEntries(url.searchParams.entries()));
      console.error('Notification data:', notificationData);
      const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
      if (!webhookSecret) {
        console.warn('⚠️ No webhook secret configured - allowing request in dev mode');
        return true;
      }
      return false;
    }

    const signatureTemplate = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const secretKey = webhookSecret;

    console.log('Validating signature with template:', signatureTemplate);

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
      console.error('Signature verification failed');
      console.error('Expected:', hash);
      console.error('Computed:', computedHash);
      console.error('Template used:', signatureTemplate);
      console.error('Data ID used:', dataId);
    } else {
      console.log('✅ Signature verified successfully');
    }

    return isValid;
  } catch (error) {
    console.error('Error verifying signature:', error);
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

    console.log('Webhook URL params:', urlParams);

    const requestBody = await req.json();

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

    console.log('Received MP webhook notification FULL:', JSON.stringify(notification, null, 2));
    console.log('Received MP webhook notification summary:', {
      type: notification.type,
      action: notification.action,
      data_id: notification.data?.id,
      live_mode: notification.live_mode,
      urlParams: urlParams
    });

    const paymentIdFromUrl = urlParams['id'] || urlParams['data.id'];
    const topicFromUrl = urlParams['topic'] || urlParams['type'];

    if (paymentIdFromUrl && topicFromUrl) {
      console.log('📨 Payment notification via URL params:', {
        topic: topicFromUrl,
        id: paymentIdFromUrl
      });

      const normalizedNotification = {
        type: topicFromUrl,
        action: 'payment.updated',
        data: {
          id: paymentIdFromUrl
        },
        live_mode: !paymentIdFromUrl.startsWith('TEST'),
        ...notification
      };

      if (topicFromUrl === 'payment') {
        await processPaymentNotification(supabase, normalizedNotification as WebhookNotification);
      } else if (topicFromUrl === 'merchant_order') {
        await processMerchantOrderNotification(supabase, normalizedNotification as WebhookNotification);
      } else {
        console.warn(`Unknown URL param topic: ${topicFromUrl}`);
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
      console.error('Invalid webhook signature - rejecting request');
      if (notification.data?.id || notification.type) {
        console.warn('⚠️ Processing despite signature failure (development mode)');
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
      console.log('✅ Webhook signature verified');
    }

    console.log('Processing webhook notification...');

    if (notification.type === 'payment') {
      await processPaymentNotification(supabase, notification);
    } else if (notification.type === 'merchant_order') {
      await processMerchantOrderNotification(supabase, notification);
    } else {
      console.warn('Unknown notification type:', notification.type);
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
    console.error('Webhook error:', error);
    
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

async function processPaymentNotification(supabase: any, notification: WebhookNotification) {
  try {
    const paymentId = notification.data.id;
    console.log(`📨 Processing payment notification for payment ID: ${paymentId}`);

    const { data: adminConfig, error: adminError } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .maybeSingle();

    let paymentData: any = null;
    let accessToken = '';

    if (adminConfig?.value?.access_token) {
      console.log(`🔍 Attempting to fetch payment with admin credentials...`);
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${adminConfig.value.access_token}`,
          'Content-Type': 'application/json'
        },
      });

      if (mpResponse.ok) {
        paymentData = await mpResponse.json();
        accessToken = adminConfig.value.access_token;
        console.log('✅ Payment fetched with admin credentials');
      } else {
        console.log('⚠️ Could not fetch with admin credentials, will try partner credentials');
      }
    }

    let mpApiUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
    let mpResponse: any;

    if (!paymentData) {
      console.log('⚠️ No payment data from admin credentials, trying partner credentials...');

      const { data: partners, error: partnersError } = await supabase
        .from('partners')
        .select('id, business_name, mercadopago_config')
        .not('mercadopago_config', 'is', null);

      if (partners && partners.length > 0) {
        console.log(`🔍 Found ${partners.length} partners with MP credentials, trying each...`);

        for (const partner of partners) {
          const partnerToken = partner.mercadopago_config?.access_token;
          if (!partnerToken) continue;

          console.log(`🔑 Trying credentials from partner: ${partner.business_name} (${partnerToken.substring(0, 20)}...)`);

          const testResponse = await fetch(mpApiUrl, {
            headers: {
              'Authorization': `Bearer ${partnerToken}`,
              'Content-Type': 'application/json'
            },
          });

          if (testResponse.ok) {
            paymentData = await testResponse.json();
            accessToken = partnerToken;
            console.log(`✅ Payment found with ${partner.business_name} credentials!`);
            break;
          } else {
            console.log(`❌ Payment not found with ${partner.business_name} credentials`);
          }
        }
      }
    } else if (paymentData?.external_reference) {
      const orderId = paymentData.external_reference;
      console.log(`🔍 Found external_reference: ${orderId}`);

      const { data: orderData } = await supabase
        .from('orders')
        .select('*, partners!inner(mercadopago_config)')
        .eq('id', orderId)
        .maybeSingle();

      if (orderData?.partners?.mercadopago_config?.access_token) {
        accessToken = orderData.partners.mercadopago_config.access_token;
        console.log(`🔑 Using partner credentials: ${accessToken.substring(0, 20)}...`);
      }
    }

    if (!paymentData) {
      console.log(`🔍 Last attempt: Fetching payment from MP API: ${mpApiUrl}`);

      if (!accessToken) {
        console.error('❌ No valid access token available');
        return;
      }

      console.log(`🔑 Using access token: ${accessToken.substring(0, 20)}...`);

      mpResponse = await fetch(mpApiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
      });

      if (!mpResponse.ok) {
        console.error(`❌ Failed to fetch payment from MP API: ${mpResponse.status}`);
        const errorText = await mpResponse.text();
        console.error('MP API Error:', errorText);

        if (mpResponse.status === 404) {
          console.error('💡 Payment not found (404). Possible causes:');
          console.error('   - Payment was not completed (user abandoned checkout)');
          console.error('   - Wrong access token (using token from different account)');
          console.error('   - Mixed environments (test token with prod payment ID or vice versa)');
          console.error('   - Payment ID is actually a preference_id or merchant_order_id');
          console.log('ℹ️ This is normal if the user created a preference but never completed the payment');
          console.log('✅ No action needed - order will remain in pending status');
        } else if (mpResponse.status === 401) {
          console.error('💡 Unauthorized (401). Check access token is valid and not expired');
        }

        return;
      }

      paymentData = await mpResponse.json();
    }

    if (!paymentData) {
      console.error('❌ No payment data available');
      return;
    }

    console.log('✅ Payment data fetched from MP API');
    console.log(`   Status: ${paymentData.status}`);
    console.log(`   Status Detail: ${paymentData.status_detail}`);
    console.log(`   Transaction Amount: ${paymentData.transaction_amount}`);
    console.log(`   External Reference: ${paymentData.external_reference}`);
    console.log(`   Payment Method: ${paymentData.payment_method_id}`);

    let orderId = paymentData.external_reference;

    if (!orderId) {
      console.error('❌ No external_reference found in payment. Cannot identify order.');
      console.log('Payment data:', JSON.stringify(paymentData, null, 2));
      return;
    }

    console.log(`🔍 Looking for order: ${orderId}`);

    // Verificar si el orderId es un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(orderId)) {
      console.warn(`⚠️ external_reference is not a valid UUID: ${orderId}`);

      // Intentar buscar la orden usando el preference_id del payment
      const preferenceId = paymentData.metadata?.preference_id || paymentData.order?.id;

      console.log('🔍 Attempting to find order by payment_preference_id...');
      console.log('   Payment ID:', paymentData.id);
      console.log('   Preference ID from metadata:', paymentData.metadata?.preference_id);
      console.log('   Order ID from payment:', paymentData.order?.id);

      if (!preferenceId) {
        console.error('❌ No preference_id found in payment data');
        console.log('Payment data structure:', JSON.stringify({
          id: paymentData.id,
          metadata: paymentData.metadata,
          order: paymentData.order,
          external_reference: paymentData.external_reference
        }, null, 2));
        console.error('This payment may belong to a preference that was never converted to an order');
        return;
      }

      const { data: orderByPref, error: prefError } = await supabase
        .from('orders')
        .select('*, partners!inner(mercadopago_config)')
        .eq('payment_preference_id', preferenceId)
        .maybeSingle();

      if (orderByPref) {
        console.log(`✅ Found order by payment_preference_id: ${orderByPref.id}`);
        orderId = orderByPref.id;
      } else {
        console.error(`❌ Could not find order with payment_preference_id: ${preferenceId}`);
        console.error('This payment may belong to a preference that was never converted to an order');
        return;
      }
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, partners!inner(mercadopago_config)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !orderData) {
      console.error('❌ Error fetching order or order not found:', {
        error: orderError,
        orderId,
        hint: 'The order may not exist or the external_reference format is incorrect'
      });
      return;
    }

    console.log(`✅ Found order: ${orderId}`);
    console.log(`   Current status: ${orderData.status}`);
    console.log(`   Current payment_status: ${orderData.payment_status || 'none'}`);
    console.log(`   Order type: ${orderData.order_type}`);

    const paymentStatus = paymentData.status;
    const statusDetail = paymentData.status_detail;
    const orderStatus = mapPaymentStatusToOrderStatus(paymentStatus);

    console.log(`💰 Payment validation:`);
    console.log(`   MP Status: ${paymentStatus}`);
    console.log(`   MP Status Detail: ${statusDetail}`);
    console.log(`   Order Status (mapped): ${orderStatus}`);

    const isApproved = paymentStatus === 'approved' && statusDetail === 'accredited';
    console.log(`   Is Approved & Accredited: ${isApproved}`);

    const totalAmount = paymentData.transaction_amount;
    const commissionAmount = orderData.commission_amount || (totalAmount * 0.05);
    const partnerAmount = totalAmount - commissionAmount;

    console.log(`💵 Amounts:`);
    console.log(`   Total: $${totalAmount}`);
    console.log(`   Commission (5%): $${commissionAmount}`);
    console.log(`   Partner: $${partnerAmount}`);

    console.log(`📝 Updating order ${orderId} to status: ${orderStatus}`);

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
      console.error('❌ Error updating order:', updateError);
      return;
    }

    console.log(`✅ Order ${orderId} updated successfully`);

    if (isApproved) {
      console.log('🎉 Payment is APPROVED and ACCREDITED! Processing...');

      await updateProductStock(supabase, orderId);

      if (orderData.order_type === 'service_booking' && orderData.booking_id) {
        console.log(`📅 Updating booking ${orderData.booking_id} status to confirmed`);
        await updateBookingStatus(supabase, orderData.booking_id, 'confirmed', paymentId);
      }

      // Fallback robusto: disparar envío contable explícitamente al confirmar pago
      // (evita pérdida de envíos si el trigger de BD falla en algún escenario)
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
          console.warn('⚠️ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY, skipping accounting fallback call');
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
          console.log('📨 Accounting fallback response:', {
            status: accountingResponse.status,
            ok: accountingResponse.ok,
            body: accountingBody.slice(0, 500),
          });
        }
      } catch (accountingError) {
        console.error('❌ Error triggering accounting fallback from MP webhook:', accountingError);
      }

      console.log('✅ All post-payment actions completed');
    } else {
      console.log(`⏸️ Payment not approved yet. Status: ${paymentStatus}, Detail: ${statusDetail}`);
    }

  } catch (error) {
    console.error('❌ Error processing payment notification:', error);
    throw error;
  }
}

async function processMerchantOrderNotification(supabase: any, notification: WebhookNotification) {
  try {
    const merchantOrderId = notification.data?.id;
    console.log('Processing merchant order notification:', merchantOrderId);

    if (!merchantOrderId) {
      console.error('❌ merchant_order notification without data.id');
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
      console.error('❌ No Mercado Pago access tokens available to process merchant_order');
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
        console.log('✅ merchant_order fetched from MP API');
        break;
      }
    }

    if (!merchantOrderData) {
      console.error(`❌ Could not fetch merchant_order ${merchantOrderId} with available credentials`);
      return;
    }

    const payments = merchantOrderData.payments || [];
    if (payments.length === 0) {
      console.warn(`⚠️ merchant_order ${merchantOrderId} has no payments yet`);
      return;
    }

    const approvedPayment = payments.find((payment: any) => payment.status === 'approved');
    const selectedPayment = approvedPayment || payments[0];

    if (!selectedPayment?.id) {
      console.warn(`⚠️ merchant_order ${merchantOrderId} has payments without id`);
      return;
    }

    console.log(`🔁 Converting merchant_order to payment notification using payment ${selectedPayment.id}`);

    await processPaymentNotification(supabase, {
      ...notification,
      type: 'payment',
      action: 'payment.updated',
      data: {
        id: String(selectedPayment.id)
      }
    } as WebhookNotification);
  } catch (error) {
    console.error('Error processing merchant order notification:', error);
    throw error;
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
  try {
    console.log(`Updating product stock for order ${orderId}`);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('items')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Error fetching order:', orderError);
      return;
    }

    const items = order.items;
    if (!items || items.length === 0) {
      console.log('No items found in order');
      return;
    }

    console.log(`Processing ${items.length} items for stock update`);

    for (const item of items) {
      const productId = item.id;
      const quantity = item.quantity || 1;

      console.log(`Reducing stock for product ${productId} by ${quantity}`);

      const { data: product, error: productError } = await supabase
        .from('partner_products')
        .select('stock, name')
        .eq('id', productId)
        .single();

      if (productError) {
        console.error(`Error fetching product ${productId}:`, productError);
        continue;
      }

      const currentStock = product.stock || 0;
      const newStock = Math.max(0, currentStock - quantity);

      console.log(`Product "${product.name}": ${currentStock} -> ${newStock}`);

      const { error: updateError } = await supabase
        .from('partner_products')
        .update({
          stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (updateError) {
        console.error(`Error updating stock for product ${productId}:`, updateError);
      } else {
        console.log(`Stock updated successfully for product ${productId}`);
      }

      if (newStock <= 5 && newStock > 0) {
        console.warn(`⚠️ Low stock warning for product ${productId}: ${newStock} units remaining`);
      } else if (newStock === 0) {
        console.warn(`⚠️ Product ${productId} is now out of stock`);
      }
    }

    console.log(`✅ Stock update completed for order ${orderId}`);
  } catch (error) {
    console.error('Error updating product stock:', error);
  }
}

async function updateBookingStatus(supabase: any, bookingId: string, status: string, paymentId: string) {
  try {
    console.log(`Updating booking ${bookingId} to status: ${status}`);

    const { error } = await supabase
      .from('bookings')
      .update({
        status: status,
        payment_status: 'paid',
        payment_transaction_id: paymentId,
        payment_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }

    console.log(`✅ Booking ${bookingId} updated to status: ${status}`);
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
}
