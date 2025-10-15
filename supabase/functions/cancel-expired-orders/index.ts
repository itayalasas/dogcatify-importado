import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Cron-Secret",
};

/**
 * Edge Function para cancelar órdenes expiradas (más de 10 minutos sin confirmar)
 * Esta función:
 * 1. Busca órdenes en estado 'pending' con más de 10 minutos
 * 2. Cancela la reserva asociada
 * 3. Cancela el pago en Mercado Pago si existe
 * 4. Actualiza el estado de la orden a 'cancelled'
 *
 * Seguridad: Esta función es pública pero requiere un token secreto en el header X-Cron-Secret
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Validar token secreto para seguridad
    const cronSecret = req.headers.get('X-Cron-Secret');
    const expectedSecret = Deno.env.get('CRON_SECRET') || 'default-secret-change-me';

    if (cronSecret !== expectedSecret) {
      console.error('❌ Invalid or missing cron secret');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Invalid or missing X-Cron-Secret header'
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Iniciando limpieza de órdenes expiradas...');

    // Calcular el timestamp de hace 10 minutos
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    console.log(`Buscando órdenes creadas antes de: ${tenMinutesAgo.toISOString()}`);

    // Buscar órdenes pendientes con más de 10 minutos
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', tenMinutesAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching expired orders:', fetchError);
      throw fetchError;
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      console.log('✅ No hay órdenes expiradas para cancelar');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired orders found',
          cancelledCount: 0
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }

    console.log(`⚠️ Encontradas ${expiredOrders.length} órdenes expiradas`);

    let cancelledCount = 0;
    let errors: any[] = [];

    // Procesar cada orden expirada
    for (const order of expiredOrders) {
      try {
        console.log(`\n📦 Procesando orden: ${order.id}`);
        console.log(`   Creada: ${order.created_at}`);
        console.log(`   Tipo: ${order.order_type}`);
        console.log(`   Payment Preference ID: ${order.payment_preference_id}`);

        // 1. Cancelar la reserva asociada si existe
        if (order.booking_id) {
          console.log(`   Cancelando reserva: ${order.booking_id}`);

          const { error: bookingError } = await supabase
            .from('bookings')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.booking_id);

          if (bookingError) {
            console.error(`   ❌ Error cancelando reserva:`, bookingError);
            errors.push({ orderId: order.id, error: 'Failed to cancel booking' });
          } else {
            console.log(`   ✅ Reserva cancelada`);
          }
        }

        // 2. Cancelar el pago en Mercado Pago si existe payment_preference_id
        if (order.payment_preference_id) {
          try {
            await cancelMercadoPagoPayment(order.payment_preference_id, order.partner_id, supabase);
            console.log(`   ✅ Pago cancelado en Mercado Pago`);
          } catch (mpError) {
            console.error(`   ⚠️ Error cancelando pago en MP (puede que no se haya iniciado):`, mpError);
            // No bloqueamos la cancelación de la orden si falla MP
          }
        }

        // 3. Actualizar el estado de la orden
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            payment_status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        if (orderError) {
          console.error(`   ❌ Error actualizando orden:`, orderError);
          errors.push({ orderId: order.id, error: 'Failed to update order' });
        } else {
          console.log(`   ✅ Orden cancelada`);
          cancelledCount++;
        }

      } catch (error) {
        console.error(`❌ Error procesando orden ${order.id}:`, error);
        errors.push({ orderId: order.id, error: error.message });
      }
    }

    console.log(`\n✅ Limpieza completada:`);
    console.log(`   - Órdenes canceladas: ${cancelledCount}`);
    console.log(`   - Errores: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cancelled ${cancelledCount} expired orders`,
        cancelledCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error) {
    console.error('❌ Error in cancel-expired-orders function:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
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

/**
 * Cancelar un pago en Mercado Pago
 */
async function cancelMercadoPagoPayment(
  preferenceId: string,
  partnerId: string,
  supabase: any
): Promise<void> {
  try {
    // Obtener la configuración de Mercado Pago del partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('mercadopago_config')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner?.mercadopago_config?.access_token) {
      console.log('   ⚠️ No se encontró configuración de MP para el partner');
      return;
    }

    const accessToken = partner.mercadopago_config.access_token;

    // Buscar el pago asociado a esta preferencia
    // Nota: Mercado Pago no permite cancelar una preferencia directamente,
    // solo podemos cancelar pagos ya iniciados
    const searchUrl = `https://api.mercadopago.com/v1/payments/search?external_reference=${preferenceId}`;

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      console.log('   ⚠️ No se encontraron pagos para esta preferencia');
      return;
    }

    const searchData = await searchResponse.json();

    if (!searchData.results || searchData.results.length === 0) {
      console.log('   ℹ️ No hay pagos iniciados para cancelar');
      return;
    }

    // Cancelar cada pago encontrado que esté pendiente
    for (const payment of searchData.results) {
      if (payment.status === 'pending' || payment.status === 'in_process') {
        console.log(`   Cancelando pago MP: ${payment.id}`);

        const cancelUrl = `https://api.mercadopago.com/v1/payments/${payment.id}`;

        const cancelResponse = await fetch(cancelUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'cancelled'
          }),
        });

        if (cancelResponse.ok) {
          console.log(`   ✅ Pago ${payment.id} cancelado en MP`);
        } else {
          const errorData = await cancelResponse.json();
          console.error(`   ❌ Error cancelando pago ${payment.id}:`, errorData);
        }
      }
    }

  } catch (error) {
    console.error('Error en cancelMercadoPagoPayment:', error);
    throw error;
  }
}
