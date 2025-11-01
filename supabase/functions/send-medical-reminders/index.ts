import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.43.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for pending medical reminders...');

    const { data: pendingAlerts, error: alertsError } = await supabase
      .rpc('get_pending_notifications');

    if (alertsError) {
      console.error('Error fetching pending alerts:', alertsError);
      throw alertsError;
    }

    if (!pendingAlerts || pendingAlerts.length === 0) {
      console.log('No pending alerts found');
      return new Response(
        JSON.stringify({ message: 'No pending alerts', processed: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${pendingAlerts.length} pending alerts`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const alert of pendingAlerts) {
      try {
        console.log(`Processing alert ${alert.alert_id} for user ${alert.user_id}`);

        const notificationType = alert.should_notify_72h ? '72h' : '24h';
        const timeText = alert.should_notify_72h ? '3 días' : '24 horas';

        const title = alert.title;
        const body = `${alert.pet_name}: ${alert.description || alert.title} en ${timeText}`;

        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('push_token, notification_preferences')
          .eq('id', alert.user_id)
          .maybeSingle();

        if (profileError) {
          console.error(`Error fetching profile for user ${alert.user_id}:`, profileError);
          errorCount++;
          results.push({ alert_id: alert.alert_id, success: false, error: 'Profile not found' });
          continue;
        }

        if (!userProfile?.push_token) {
          console.log(`User ${alert.user_id} has no push token`);
          await supabase.rpc('mark_notification_sent', {
            p_alert_id: alert.alert_id,
            p_notification_type: notificationType,
          });
          results.push({ alert_id: alert.alert_id, success: true, skipped: 'No push token' });
          continue;
        }

        const expoPushMessage = {
          to: userProfile.push_token,
          sound: 'default',
          title: title,
          body: body,
          data: {
            type: 'medical_reminder',
            alertId: alert.alert_id,
            petId: alert.pet_id,
            alertType: alert.alert_type,
            scheduledDate: alert.scheduled_date,
          },
          priority: 'high',
          channelId: 'medical-reminders',
        };

        const expoPushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(expoPushMessage),
        });

        if (!expoPushResponse.ok) {
          const errorText = await expoPushResponse.text();
          console.error(`Failed to send push notification: ${errorText}`);
          errorCount++;
          results.push({ alert_id: alert.alert_id, success: false, error: 'Push send failed' });
          continue;
        }

        const pushResult = await expoPushResponse.json();
        console.log('Push notification sent:', pushResult);

        const { error: markError } = await supabase.rpc('mark_notification_sent', {
          p_alert_id: alert.alert_id,
          p_notification_type: notificationType,
        });

        if (markError) console.error('Error marking notification as sent:', markError);

        successCount++;
        results.push({
          alert_id: alert.alert_id,
          success: true,
          notification_type: notificationType,
          push_result: pushResult,
        });

      } catch (error) {
        console.error(`Error processing alert ${alert.alert_id}:`, error);
        errorCount++;
        results.push({ alert_id: alert.alert_id, success: false, error: error.message });
      }
    }

    console.log(`Processed ${results.length} alerts: ${successCount} sent, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: results.length,
        sent: successCount,
        errors: errorCount,
        results: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-medical-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
