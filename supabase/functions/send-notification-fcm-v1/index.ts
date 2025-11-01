import { getAccessToken, parseServiceAccount } from '../_shared/firebase-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotificationPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  channelId?: string;
}

interface FCMMessage {
  message: {
    token: string;
    notification?: {
      title: string;
      body: string;
      image?: string;
    };
    data?: Record<string, string>;
    android?: {
      priority: string;
      notification: {
        sound: string;
        channelId: string;
        defaultSound: boolean;
        defaultVibrateTimings: boolean;
      };
    };
    apns?: {
      payload: {
        aps: {
          sound: string;
          badge: number;
          alert: {
            title: string;
            body: string;
          };
          contentAvailable?: boolean;
        };
      };
    };
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');

    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({
          error: 'FIREBASE_SERVICE_ACCOUNT not configured',
          message: 'Please configure Firebase Service Account in Supabase secrets'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const serviceAccount = parseServiceAccount(serviceAccountJson);
    const projectId = serviceAccount.project_id;

    const payload: NotificationPayload = await req.json();

    if (!payload.token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Getting access token...');
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Access token obtained successfully');

    const message: FCMMessage = {
      message: {
        token: payload.token,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { image: payload.imageUrl }),
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: payload.sound || 'default',
            channelId: payload.channelId || 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: payload.sound || 'default',
              badge: payload.badge || 0,
              alert: {
                title: payload.title,
                body: payload.body,
              },
              contentAvailable: true,
            },
          },
        },
      },
    };

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    console.log('Sending notification to FCM v1 API...');
    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('FCM Error:', result);
      return new Response(
        JSON.stringify({
          error: 'Failed to send notification',
          details: result,
          status: response.status
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Notification sent successfully:', result.name);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.name,
        result
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
