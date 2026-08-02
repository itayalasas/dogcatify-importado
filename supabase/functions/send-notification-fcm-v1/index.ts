import { createClient } from 'npm:@supabase/supabase-js@2.43.2';
import { getAccessToken, parseServiceAccount } from '../_shared/firebase-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotificationPayload {
  token: string;
  expoPushToken?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  channelId?: string;
}

type PushTokenType = 'fcm' | 'expo' | 'apns' | 'unknown';

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

function detectPushTokenType(token?: string | null): PushTokenType {
  if (!token) {
    return 'unknown';
  }

  if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
    return 'expo';
  }

  if (/^[a-f0-9]{64}$/i.test(token)) {
    return 'apns';
  }

  if (token.includes(':') || token.length > 80) {
    return 'fcm';
  }

  return 'unknown';
}

async function parseJsonRequest(req: Request): Promise<{ payload?: NotificationPayload; errorResponse?: Response }> {
  const rawBody = await req.text();

  if (!rawBody.trim()) {
    return {
      errorResponse: new Response(
        JSON.stringify({
          error: 'Request body is required',
          message: 'Expected a JSON payload with token, title and body',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  try {
    return {
      payload: JSON.parse(rawBody) as NotificationPayload,
    };
  } catch (error) {
    return {
      errorResponse: new Response(
        JSON.stringify({
          error: 'Invalid JSON body',
          message: error instanceof Error ? error.message : 'Failed to parse request body as JSON',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      ),
    };
  }
}

async function parseResponseBody(response: Response): Promise<any> {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      raw: responseText,
    };
  }
}

async function sendViaExpo(
  expoPushToken: string,
  payload: NotificationPayload,
): Promise<{ response: Response; result: any; ticket: any }> {
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (expoAccessToken) {
    headers['Authorization'] = `Bearer ${expoAccessToken}`;
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: expoPushToken,
      sound: payload.sound || 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: 'high',
      channelId: payload.channelId || 'default',
    }),
  });

  const result = await parseResponseBody(response);
  const ticket = Array.isArray(result?.data) ? result.data[0] : (result?.data ?? result);

  return {
    response,
    result,
    ticket,
  };
}

async function resolveExpoPushTokenFromProfiles(apnsToken: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('fcm_token', apnsToken)
      .maybeSingle();

    if (error) {
      console.warn('Could not resolve Expo push token from profiles:', error.message);
      return null;
    }

    const pushToken = profile?.push_token ?? null;
    return detectPushTokenType(pushToken) === 'expo' ? pushToken : null;
  } catch (error) {
    console.warn(
      'Unexpected error resolving Expo push token from profiles:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
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

function buildFcmMessage(payload: NotificationPayload): FCMMessage {
  return {
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
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { payload, errorResponse } = await parseJsonRequest(req);

    if (errorResponse) {
      return errorResponse;
    }

    if (!payload) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request payload',
          message: 'Notification payload could not be read',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

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

    const primaryTokenType = detectPushTokenType(payload.token);
    let expoPushToken = detectPushTokenType(payload.expoPushToken) === 'expo'
      ? payload.expoPushToken!
      : (primaryTokenType === 'expo' ? payload.token : null);

    if (!expoPushToken && primaryTokenType === 'apns') {
      expoPushToken = await resolveExpoPushTokenFromProfiles(payload.token);
    }

    if (primaryTokenType === 'apns' && !expoPushToken) {
      return new Response(
        JSON.stringify({
          error: 'APNs token is not supported by this endpoint',
          message: 'The provided token looks like an iOS APNs token. Use the Expo push token from profiles.push_token or a real Android FCM token.',
          tokenType: primaryTokenType,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (primaryTokenType === 'expo' || (primaryTokenType === 'apns' && expoPushToken)) {
      console.log('Sending notification via Expo Push Service...');

      const { response, result, ticket } = await sendViaExpo(expoPushToken!, payload);
      const normalizedExpoResult = result ?? {
        emptyBody: true,
        status: response.status,
        statusText: response.statusText,
      };

      if (!response.ok || ticket?.status === 'error') {
        return new Response(
          JSON.stringify({
            error: 'Failed to send notification',
            details: ticket ?? normalizedExpoResult,
            provider: 'expo',
            status: response.ok ? 400 : response.status,
          }),
          {
            status: response.ok ? 400 : response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          provider: 'expo',
          messageId: ticket?.id ?? null,
          result: normalizedExpoResult,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    let serviceAccount: any = null;

    if (serviceAccountJson) {
      try {
        serviceAccount = parseServiceAccount(serviceAccountJson);
      } catch {
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

    console.log('Getting access token...');
    const accessToken = await getAccessToken(serviceAccount);
    console.log('Access token obtained successfully');

  const fcmUrl =
  `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

console.log('Sending notification directly to FCM HTTP v1 API...', {
  projectId,
  tokenType: primaryTokenType,
});

const response = await fetch(fcmUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify(buildFcmMessage(payload)),
});

    const result = await parseResponseBody(response);
    const normalizedResult = result ?? {
      emptyBody: true,
      status: response.status,
      statusText: response.statusText,
    };

    if (!response.ok) {
      const fcmErrorMessage = normalizedResult?.error?.message || '';
      const fcmErrorCode = normalizedResult?.error?.details?.[0]?.errorCode || null;

      if (expoPushToken) {
        if (
          typeof fcmErrorMessage === 'string'
          && fcmErrorMessage.toLowerCase().includes('not a valid fcm registration token')
        ) {
          console.warn('Invalid FCM token detected, trying Expo fallback...');

          const { response: expoResponse, result: expoResult, ticket } = await sendViaExpo(expoPushToken, payload);
          const normalizedExpoResult = expoResult ?? {
            emptyBody: true,
            status: expoResponse.status,
            statusText: expoResponse.statusText,
          };

          if (expoResponse.ok && ticket?.status !== 'error') {
            return new Response(
              JSON.stringify({
                success: true,
                provider: 'expo-fallback',
                messageId: ticket?.id ?? null,
                result: normalizedExpoResult,
              }),
              {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }
      }

      if (fcmErrorCode === 'SENDER_ID_MISMATCH') {
        console.error('FCM SenderId mismatch detected:', {
          firebaseProjectId: projectId,
          tokenType: primaryTokenType,
          details: normalizedResult,
        });

        return new Response(
          JSON.stringify({
            error: 'Failed to send notification',
            provider: 'fcm-v1',
            status: response.status,
            firebaseProjectId: projectId,
            tokenType: primaryTokenType,
            details: normalizedResult,
            message: 'The device token belongs to a different Firebase project than the service account configured in this function.',
          }),
          {
            status: response.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.error('FCM Error:', normalizedResult);
      return new Response(
        JSON.stringify({
          error: 'Failed to send notification',
          details: normalizedResult,
          provider: 'fcm-v1',
          status: response.status,
          firebaseProjectId: projectId,
          tokenType: primaryTokenType,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const messageId = normalizedResult?.name ?? null;

    console.log('Notification sent successfully:', messageId ?? `HTTP ${response.status} ${response.statusText}`);

    return new Response(
      JSON.stringify({
        success: true,
        provider: 'fcm-v1',
        messageId,
        result: normalizedResult
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
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
