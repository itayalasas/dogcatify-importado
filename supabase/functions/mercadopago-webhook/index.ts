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
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook notification
    const notification: WebhookNotification = await req.json();
    
    console.log('Received MP webhook:', notification);

    // Verify webhook authenticity (optional but recommended)
    // You should implement webhook signature verification here

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
    
    // Get admin MP configuration
    const { data: adminConfig, error: adminError } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'mercadopago_config')
      .single();

    if (adminError || !adminConfig?.value?.access_token) {
      console.error('Admin MP configuration not found:', adminError);
      throw new Error('Admin MP configuration not found');
    }

    // Fetch payment details from Mercado Pago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${adminConfig.value.access_token}`,
      },
    });

    if (!mpResponse.ok) {
      throw new Error(`Failed to fetch payment: ${mpResponse.status}`);
    }

    const paymentData = await mpResponse.json();
    console.log('Payment data:', paymentData);

    // Find order by external reference
    const orderId = paymentData.external_reference;
    if (!orderId) {
      console.log('No external reference found in payment');
      return;
    }

    // Get order details to calculate commission split
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*, partners!inner(mercadopago_config)')
      .eq('id', orderId)
      .single();
    
    if (orderError) {
      console.error('Error fetching order:', orderError);
      throw orderError;
    }
    
    // Calculate commission amounts
    const totalAmount = paymentData.transaction_amount || orderData.total_amount;
    const commissionAmount = orderData.commission_amount || (totalAmount * 0.05);
    const partnerAmount = totalAmount - commissionAmount;

    // Update order status based on payment status
    const orderStatus = mapPaymentStatusToOrderStatus(paymentData.status);
    
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: orderStatus,
        payment_id: paymentId,
        payment_status: paymentData.status,
        payment_data: paymentData,
        commission_amount: commissionAmount,
        partner_amount: partnerAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw updateError;
    }

    console.log(`Order ${orderId} updated to status: ${orderStatus}`);
    console.log(`Commission: $${commissionAmount}, Partner: $${partnerAmount}`);

    // Send notification email to customer if payment is approved
    if (paymentData.status === 'approved') {
      await sendPaymentConfirmationEmail(supabase, orderId);
    }

  } catch (error) {
    console.error('Error processing payment notification:', error);
    throw error;
  }
}

async function processMerchantOrderNotification(supabase: any, notification: WebhookNotification) {
  try {
    // Handle merchant order notifications if needed
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

async function sendPaymentConfirmationEmail(supabase: any, orderId: string) {
  try {
    // Get order details
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

    // Send email notification
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

    // Call email function
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