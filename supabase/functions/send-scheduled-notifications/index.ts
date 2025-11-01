import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener notificaciones pendientes que ya deberían haberse enviado
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50); // Procesar máximo 50 por ejecución

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Error fetching notifications', details: fetchError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending notifications', count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Processing ${pendingNotifications.length} notifications...`);

    const results = [];

    for (const notification of pendingNotifications) {
      try {
        // Obtener el push token del usuario
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('push_token')
          .eq('id', notification.user_id)
          .single();

        if (profileError || !profile?.push_token) {
          console.log(`No push token for user ${notification.user_id}`);
          
          // Marcar como fallida
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'failed',
              error_message: 'No push token available',
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          results.push({
            notification_id: notification.id,
            status: 'failed',
            reason: 'No push token',
          });
          continue;
        }

        // Preparar mensaje de notificación
        const message = {
          to: profile.push_token,
          sound: 'default',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: 'high',
          channelId: 'default',
        };

        // Enviar notificación a Expo Push Service
        const expoPushUrl = 'https://exp.host/--/api/v2/push/send';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };

        if (expoAccessToken) {
          headers['Authorization'] = `Bearer ${expoAccessToken}`;
        }

        const pushResponse = await fetch(expoPushUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(message),
        });

        const pushResult = await pushResponse.json();
        console.log('Push result:', JSON.stringify(pushResult));

        // Verificar resultado
        const ticket: PushTicket = pushResult.data?.[0] || pushResult;

        if (ticket.status === 'ok') {
          // Marcar como enviada exitosamente
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', notification.id);

          results.push({
            notification_id: notification.id,
            status: 'sent',
            ticket_id: ticket.id,
          });
        } else {
          // Error al enviar
          const retryCount = (notification.retry_count || 0) + 1;
          const maxRetries = 3;

          if (retryCount < maxRetries) {
            // Reintentar más tarde
            await supabase
              .from('scheduled_notifications')
              .update({
                retry_count: retryCount,
                error_message: ticket.message || 'Unknown error',
                updated_at: new Date().toISOString(),
              })
              .eq('id', notification.id);

            results.push({
              notification_id: notification.id,
              status: 'retry',
              retry_count: retryCount,
              error: ticket.message,
            });
          } else {
            // Máximo de reintentos alcanzado
            await supabase
              .from('scheduled_notifications')
              .update({
                status: 'failed',
                retry_count: retryCount,
                error_message: ticket.message || 'Max retries exceeded',
                updated_at: new Date().toISOString(),
              })
              .eq('id', notification.id);

            results.push({
              notification_id: notification.id,
              status: 'failed',
              error: 'Max retries exceeded',
            });
          }
        }
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Incrementar retry count
        const retryCount = (notification.retry_count || 0) + 1;
        await supabase
          .from('scheduled_notifications')
          .update({
            retry_count: retryCount,
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        results.push({
          notification_id: notification.id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Notifications processed',
        total: pendingNotifications.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});