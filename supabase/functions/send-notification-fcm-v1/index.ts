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

function buildServiceAccountFromEnv() {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
  const privateKeyId = Deno.env.get('FIREBASE_PRIVATE_KEY_ID');
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const clientId = Deno.env.get('FIREBASE_CLIENT_ID');
  const clientCertUrl = Deno.env.get('FIREBASE_CLIENT_CERT_URL');

  if (!projectId || !privateKey || !privateKeyId || !clientEmail || !clientId || !clientCertUrl) {
    return null;
  }

  return {
    type: 'service_account',
    project_id: projectId,
    private_key_id: privateKeyId,
    private_key: privateKey.replace(/\\n/g, '\n'),
    client_email: clientEmail,
    client_id: clientId,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: clientCertUrl,
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
    let serviceAccount: any = null;

    if (serviceAccountJson) {
      try {
        serviceAccount = parseServiceAccount(serviceAccountJson);
      } catch (parseError) {
        console.warn('Invalid FIREBASE_SERVICE_ACCOUNT JSON, trying split FIREBASE_* secrets fallback');
      }
    }

    if (!serviceAccount) {
      serviceAccount = buildServiceAccountFromEnv();
    }

    if (!serviceAccount) {
      return new Response(
        JSON.stringify({
          error: 'Firebase credentials not configured',
          message: 'Set FIREBASE_SERVICE_ACCOUNT or split FIREBASE_* secrets (PROJECT_ID, PRIVATE_KEY, PRIVATE_KEY_ID, CLIENT_EMAIL, CLIENT_ID, CLIENT_CERT_URL)'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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

   const fcmUrl = `https://api.flowbridge.site/functions/v1/api-gateway/47256d34-2e5f-4b33-ac5d-5d2723bfd917`;
    console.log('Sending notification to FCM v1 API...');
    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'projectId': `${projectId}`,
        'X-Integration-Key': 'int_b0009562b2f8091143508c3603abb199252ebfc071f6eb51d3042007b02c9ba6',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(message)
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
