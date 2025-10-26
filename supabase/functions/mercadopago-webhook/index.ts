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
    // Try multiple ways to get data.id
    const dataId = url.searchParams.get('data.id') ||
                   url.searchParams.get('id') ||
                   notificationData?.data?.id ||
                   '';

    if (!dataId) {
      console.error('Missing data.id for signature validation');
      console.error('URL search params:', Object.fromEntries(url.searchParams.entries()));
      console.error('Notification data:', notificationData);
      // In development, allow without signature if webhook secret is not configured
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

    // Parse body first
    const notification: WebhookNotification = await req.json();

    // Log incoming notification
    console.log('Received MP webhook notification:', {
      type: notification.type,
      action: notification.action,
      data_id: notification.data?.id,
      live_mode: notification.live_mode
    });

    const isValid = await verifyWebhookSignature(req, notification);

    if (!isValid) {
      console.error('Invalid webhook signature - rejecting request');
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

    console.log('Received MP webhook (signature verified):', notification);

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
      .or(`payment_id.eq.${paymentId},payment_preference_id.eq.${paymentId}`)
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

      const mpApiUrl = adminConfig.value.is_test_mode
        ? `https://api.mercadopago.com/v1/payments/${paymentId}`
        : `https://api.mercadopago.com/v1/payments/${paymentId}`;

      console.log(`Calling MP API: ${mpApiUrl}`);

      const mpResponse = await fetch(mpApiUrl, {
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
      console.log('Payment data from MP:', JSON.stringify(paymentData, null, 2));

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

      if (orderData.order_type === 'service_booking' && orderData.booking_id) {
        console.log(`Updating booking ${orderData.booking_id} status to confirmed`);
        await updateBookingStatus(supabase, orderData.booking_id, 'confirmed', paymentId);
        await sendBookingConfirmationEmail(supabase, orderData.booking_id);
      }
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

      console.log(`Product \"${product.name}\": ${currentStock} -> ${newStock}`);

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
        <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">
          <div style=\"background-color: #2D6A6F; padding: 20px; text-align: center;\">
            <h1 style=\"color: white; margin: 0;\">¡Pago Confirmado!</h1>
          </div>
          <div style=\"padding: 20px; background-color: #f9f9f9;\">
            <p>Hola <strong>${order.profiles.display_name}</strong>,</p>
            <p>Tu pago ha sido confirmado exitosamente.</p>
            <div style=\"background-color: white; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;\">
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

async function sendBookingConfirmationEmail(supabase: any, bookingId: string) {
  try {
    console.log(`Sending booking confirmation email for booking ${bookingId}`);

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:profiles!customer_id(email, display_name)
      `)
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      console.error('Error fetching booking for email:', error);
      return;
    }

    if (!booking.customer || !booking.customer.email) {
      console.error('Customer email not found for booking');
      return;
    }

    const bookingDate = new Date(booking.date);
    const formattedDate = bookingDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailData = {
      to: booking.customer.email,
      subject: '¡Reserva Confirmada! - DogCatiFy',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset=\"utf-8\">
          <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
        </head>
        <body style=\"margin: 0; padding: 0; background-color: #f4f4f7; font-family: Arial, sans-serif;\">
          <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color: #f4f4f7;\">
            <tr>
              <td align=\"center\" style=\"padding: 40px 20px;\">
                <table width=\"600\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;\">
                  <tr>
                    <td style=\"background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center;\">
                      <h1 style=\"color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;\">¡Reserva Confirmada!</h1>
                      <p style=\"color: #D1FAE5; margin: 10px 0 0 0; font-size: 16px;\">Tu pago ha sido procesado exitosamente</p>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"padding: 40px 30px;\">
                      <p style=\"color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;\">
                        Hola <strong>${booking.customer.display_name}</strong>,
                      </p>
                      <p style=\"color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;\">
                        ¡Excelente noticia! Tu reserva ha sido confirmada y el pago procesado correctamente.
                      </p>
                      <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin: 30px 0; background-color: #F0FDF4; border-left: 4px solid #10B981; border-radius: 6px;\">
                        <tr>
                          <td style=\"padding: 20px;\">
                            <p style=\"color: #065F46; font-size: 14px; font-weight: 600; margin: 0 0 15px 0;\">📅 Detalles de tu Reserva</p>
                            <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"8\">
                              <tr>
                                <td style=\"color: #374151; font-size: 14px; font-weight: 600; width: 140px;\">Servicio:</td>
                                <td style=\"color: #111827; font-size: 14px;\">${booking.service_name}</td>
                              </tr>
                              <tr>
                                <td style=\"color: #374151; font-size: 14px; font-weight: 600;\">Proveedor:</td>
                                <td style=\"color: #111827; font-size: 14px;\">${booking.partner_name}</td>
                              </tr>
                              <tr>
                                <td style=\"color: #374151; font-size: 14px; font-weight: 600;\">Mascota:</td>
                                <td style=\"color: #111827; font-size: 14px;\">${booking.pet_name}</td>
                              </tr>
                              <tr>
                                <td style=\"color: #374151; font-size: 14px; font-weight: 600;\">Fecha:</td>
                                <td style=\"color: #111827; font-size: 14px;\">${formattedDate}</td>
                              </tr>
                              <tr>
                                <td style=\"color: #374151; font-size: 14px; font-weight: 600;\">Hora:</td>
                                <td style=\"color: #111827; font-size: 14px;\">${booking.time}</td>
                              </tr>
                              <tr>
                                <td style=\"color: #374151; font-size: 14px; font-weight: 600;\">Monto Pagado:</td>
                                <td style=\"color: #10B981; font-size: 16px; font-weight: 700;\">$${booking.total_amount.toLocaleString()}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      ${booking.notes ? `
                      <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin: 20px 0;\">
                        <tr>
                          <td style=\"background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; border-radius: 6px;\">
                            <p style=\"color: #92400E; font-size: 14px; margin: 0;\"><strong>Notas:</strong><br>${booking.notes}</p>
                          </td>
                        </tr>
                      </table>
                      ` : ''}
                      <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin: 30px 0;\">
                        <tr>
                          <td style=\"background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 20px; border-radius: 6px;\">
                            <p style=\"color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 12px 0;\">📋 Próximos Pasos:</p>
                            <ul style=\"color: #374151; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;\">
                              <li style=\"margin-bottom: 8px;\">El proveedor ha sido notificado de tu reserva</li>
                              <li style=\"margin-bottom: 8px;\">Recibirás recordatorios antes de tu cita</li>
                              <li>Si necesitas cancelar o reprogramar, contáctanos lo antes posible</li>
                            </ul>
                          </td>
                        </tr>
                      </table>
                      <p style=\"color: #6B7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;\">
                        ¡Gracias por confiar en DogCatiFy!<br>
                        <strong style=\"color: #374151;\">El equipo de DogCatiFy</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style=\"background-color: #F9FAFB; padding: 30px; text-align: center; border-top: 1px solid #E5E7EB;\">
                      <p style=\"color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0 0 8px 0;\">© 2025 DogCatiFy. Todos los derechos reservados.</p>
                      <p style=\"color: #9CA3AF; font-size: 11px; line-height: 1.5; margin: 0;\">Este es un correo automático, por favor no respondas a este mensaje.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
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
      console.error('Failed to send booking confirmation email');
      const errorText = await emailResponse.text();
      console.error('Email error:', errorText);
    } else {
      console.log('✅ Booking confirmation email sent successfully');
    }

  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
  }
}