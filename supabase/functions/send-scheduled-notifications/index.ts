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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');

    if (!supabaseUrl || !supabaseServiceKey) {
      const missing = [
        !supabaseUrl ? 'SUPABASE_URL' : null,
        !supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
      ].filter(Boolean);

      return new Response(
        JSON.stringify({
          error: 'Missing required environment variables',
          missing,
          hint: 'Configure function secrets before running scheduled notifications',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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


    const results = [];

    for (const notification of pendingNotifications) {
      try {
        // Obtener tokens del usuario - PRIORIZAR fcm_token (FCM v1 API)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('push_token, fcm_token')
          .eq('id', notification.user_id)
          .single();

        if (profileError || (!profile?.fcm_token && !profile?.push_token)) {

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

        let notificationSent = false;
        let sendMethod = 'none';
        let ticket: PushTicket = { status: 'error', message: 'No method available' };

        // PRIORIDAD 1: FCM v1 (API actual y recomendada)
        if (profile.fcm_token) {
          try {

            // Convertir todos los valores de data a strings (requerido por FCM v1)
            const notificationData = notification.data || {};
            const serializedData: Record<string, string> = {};

            for (const [key, value] of Object.entries(notificationData)) {
              if (value !== null && value !== undefined) {
                serializedData[key] = typeof value === 'string' ? value : JSON.stringify(value);
              }
            }

            const fcmResponse = await fetch(
              `${supabaseUrl}/functions/v1/send-notification-fcm-v1`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'apikey': supabaseServiceKey,
                },
                body: JSON.stringify({
                  token: profile.fcm_token,
                  expoPushToken: profile.push_token || undefined,
                  title: notification.title,
                  body: notification.body,
                  data: serializedData,
                  channelId: 'default',
                }),
              }
            );

            if (fcmResponse.ok) {
              const fcmResult = await fcmResponse.json();
              notificationSent = true;
              sendMethod = 'fcm-v1';
              ticket = { status: 'ok', id: fcmResult.messageId };
            } else {
              const errorText = await fcmResponse.text();
              let errorData: any = {};
              try {
                errorData = errorText ? JSON.parse(errorText) : {};
              } catch {
                errorData = { raw: errorText };
              }

              if (fcmResponse.status === 401) {
                ticket = {
                  status: 'error',
                  message: 'FCM v1 auth failed (Invalid JWT). Verify SUPABASE_SERVICE_ROLE_KEY secret in send-scheduled-notifications.',
                  details: {
                    status: 401,
                    response: errorData,
                  },
                };
              } else {
                ticket = {
                  status: 'error',
                  message: errorData?.message || errorData?.error || 'FCM v1 request failed',
                  details: {
                    status: fcmResponse.status,
                    response: errorData,
                  },
                };
              }

            }
          } catch (fcmError) {
          }
        }

        // PRIORIDAD 2: Fallback a Expo Push Service (API legacy/descontinuada)
        // Solo si FCM v1 falló y el usuario tiene push_token legacy
        if (!notificationSent && profile.push_token) {

          const message = {
            to: profile.push_token,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
            priority: 'high',
            channelId: 'default',
          };

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

          if (!pushResponse.ok) {
            const errorText = await pushResponse.text();
            ticket = {
              status: 'error',
              message: `HTTP ${pushResponse.status}: ${errorText}`,
              details: { httpStatus: pushResponse.status }
            };
          } else {
            const pushResult = await pushResponse.json();

            ticket = pushResult.data?.[0] || pushResult;

            if (ticket.status === 'ok') {
              notificationSent = true;
              sendMethod = 'expo-legacy';
            } else {
              // Log del error específico de Expo
            }
          }
        }

        // Evaluar resultado final
        if (ticket.status === 'ok' && notificationSent) {
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
            method: sendMethod,
          });
        } else {
          // Error al enviar - capturar todos los detalles posibles
          const errorMessage = ticket.message
            || ticket.details?.error
            || JSON.stringify(ticket.details || {})
            || 'Unknown error - check logs';


          const retryCount = (notification.retry_count || 0) + 1;
          const maxRetries = 3;

          if (retryCount < maxRetries) {
            // Reintentar más tarde
            await supabase
              .from('scheduled_notifications')
              .update({
                retry_count: retryCount,
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
              })
              .eq('id', notification.id);

            results.push({
              notification_id: notification.id,
              status: 'retry',
              retry_count: retryCount,
              error: errorMessage,
            });
          } else {
            // Máximo de reintentos alcanzado
            await supabase
              .from('scheduled_notifications')
              .update({
                status: 'failed',
                retry_count: retryCount,
                error_message: `Max retries exceeded. Last error: ${errorMessage}`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', notification.id);

            results.push({
              notification_id: notification.id,
              status: 'failed',
              error: 'Max retries exceeded',
              last_error: errorMessage,
            });
          }
        }
      } catch (error) {
        
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
