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

    const notification: WebhookNotification = await req.json();
    
    console.log('Received MP webhook:', notification);

    if (notification.type === 'payment') {
      await processPaymentNotification(supabase, notification);
    } else if (notification.type === 'merchant_order') {
      await processMerchantOrderNotification(supabase, notification);
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
    console.log(`Processing payment notification for payment ID: ${paymentId}`);

    const { data: orderByPayment, error: orderSearchError } = await supabase
      .from('orders')
      .select('*')
      .or(`payment_id.eq.${paymentId},preference_id.eq.${paymentId}`)
      .maybeSingle();

    let orderId = orderByPayment?.id;
    let paymentData: any = null;

    if (!orderId) {
      console.log('Order not found locally, fetching from Mercado Pago API...');

      const { data: adminConfig, error: adminError } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'mercadopago_config')
        .maybeSingle();

      if (adminError || !adminConfig?.value?.access_token) {
        console.error('Admin MP configuration not found:', adminError);
        console.log('Skipping MP API call, will retry later');
        return;
      }

      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${adminConfig.value.access_token}`,
        },
      });

      if (!mpResponse.ok) {
        console.error(`Failed to fetch payment from MP API: ${mpResponse.status}`);
        const errorText = await mpResponse.text();
        console.error('MP API Error:', errorText);
        return;
      }

      paymentData = await mpResponse.json();
      console.log('Payment data from MP:', paymentData);

      orderId = paymentData.external_reference;
      if (!orderId) {
        console.log('No external reference found in payment');
        return;
      }
    } else {
      console.log(`Order found locally: ${orderId}`);
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, partners!inner(mercadopago_config)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !orderData) {
      console.error('Error fetching order or order not found:', orderError);
      return;
    }

    console.log(`Found order: ${orderId}, current status: ${orderData.status}`);

    let paymentStatus = 'approved';
    let orderStatus = 'confirmed';

    if (paymentData) {
      paymentStatus = paymentData.status;
      orderStatus = mapPaymentStatusToOrderStatus(paymentData.status);
    } else if (notification.action) {
      if (notification.action === 'payment.created' || notification.action === 'payment.updated') {
        paymentStatus = 'approved';
        orderStatus = 'confirmed';
      }
    }

    const totalAmount = paymentData?.transaction_amount || orderData.total_amount;
    const commissionAmount = orderData.commission_amount || (totalAmount * 0.05);
    const partnerAmount = totalAmount - commissionAmount;

    console.log(`Updating order ${orderId} to status: ${orderStatus}`);

    const updateData: any = {
      status: orderStatus,
      payment_id: paymentId,
      payment_status: paymentStatus,
      commission_amount: commissionAmount,
      partner_amount: partnerAmount,
      updated_at: new Date().toISOString(),
    };

    if (paymentData) {
      updateData.payment_data = paymentData;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return;
    }

    console.log(`✅ Order ${orderId} updated to status: ${orderStatus}`);
    console.log(`Commission: $${commissionAmount}, Partner: $${partnerAmount}`);

    if (paymentStatus === 'approved' || orderStatus === 'confirmed') {
      console.log('Payment approved, updating stock and sending notifications...');
      await updateProductStock(supabase, orderId);
      await sendPaymentConfirmationEmail(supabase, orderId);
    }

  } catch (error) {
    console.error('Error processing payment notification:', error);
    throw error;
  }
}

async function processMerchantOrderNotification(supabase: any, notification: WebhookNotification) {
  try {
    console.log('Processing merchant order notification:', notification.data.id);
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

async function sendPaymentConfirmationEmail(supabase: any, orderId: string) {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        profiles:customer_id(email, display_name)
      `)
      .eq('id', orderId)
      .single();

    if (!order || !order.profiles) {
      console.log('Order or customer not found for email notification');
      return;
    }

    const emailData = {
      to: order.profiles.email,
      subject: 'Pago confirmado - DogCatiFy',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2D6A6F; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">¡Pago Confirmado!</h1>
          </div>
          <div style="padding: 20px; background-color: #f9f9f9;">
            <p>Hola <strong>${order.profiles.display_name}</strong>,</p>
            <p>Tu pago ha sido confirmado exitosamente.</p>
            <div style="background-color: white; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
              <p><strong>Número de pedido:</strong> #${orderId.slice(-6)}</p>
              <p><strong>Total pagado:</strong> $${order.total_amount.toLocaleString()}</p>
              <p><strong>Estado:</strong> Confirmado</p>
            </div>
            <p>Recibirás actualizaciones sobre el estado de tu pedido.</p>
            <p>¡Gracias por tu compra en DogCatiFy!</p>
          </div>
        </div>
      `
    };

    const emailResponse = await fetch(`${supabase.supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.supabaseKey}`,
      },
      body: JSON.stringify(emailData),
    });

    if (!emailResponse.ok) {
      console.error('Failed to send confirmation email');
    } else {
      console.log('Payment confirmation email sent');
    }

  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
}