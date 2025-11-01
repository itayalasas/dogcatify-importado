# 🔄 Migración a Firebase Cloud Messaging API v1

## 📊 Comparación: API Heredada vs API v1

| Característica | API Heredada (Legacy) | API v1 (HTTP v1) |
|----------------|----------------------|------------------|
| **Estado** | Obsoleta (deprecada 2024) | ✅ Actual y soportada |
| **Autenticación** | Server Key (simple) | OAuth 2.0 (más seguro) |
| **Endpoint** | `fcm.googleapis.com/fcm/send` | `fcm.googleapis.com/v1/projects/{project-id}/messages:send` |
| **Formato** | Más simple | Más estructurado |
| **Features** | Básicas | Avanzadas |
| **Expo Support** | ✅ Nativo | ⚠️ Requiere implementación custom |

## 🎯 Estrategia Recomendada

### Fase 1: Solución Inmediata (AHORA)
✅ Habilitar API heredada en Firebase Console
✅ Verificar que funcionen notificaciones en Android
✅ Mantener código actual

### Fase 2: Migración Gradual (Próximas semanas)
🔄 Implementar FCM API v1 en paralelo
🔄 Testing exhaustivo
🔄 Migración gradual de usuarios
🔄 Deprecar API heredada cuando todo funcione

---

# 🚀 Implementación de FCM API v1

## Paso 1: Obtener Service Account de Firebase

### 1.1 Descargar Service Account JSON

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: **app-mascota-7db30**
3. **⚙️ Project Settings** → **Service Accounts**
4. Click **"Generate new private key"**
5. Descarga el archivo JSON
6. **IMPORTANTE:** Este archivo contiene credenciales sensibles

### 1.2 Guardar en Supabase Secrets

El archivo descargado tendrá este formato:

```json
{
  "type": "service_account",
  "project_id": "app-mascota-7db30",
  "private_key_id": "xxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxx@app-mascota-7db30.iam.gserviceaccount.com",
  "client_id": "xxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "xxx"
}
```

**Guardar en Supabase:**

```bash
# En tu terminal local
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"app-mascota-7db30",...}'
```

O manualmente en Supabase Dashboard:
1. Project Settings → Edge Functions → Secrets
2. Agregar secret: `FIREBASE_SERVICE_ACCOUNT`
3. Pegar el contenido completo del JSON

## Paso 2: Crear Helper para OAuth 2.0

### 2.1 Crear función auxiliar para obtener Access Token

```typescript
// supabase/functions/_shared/firebase-auth.ts

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Genera un JWT para autenticación con Firebase
 */
async function createJWT(serviceAccount: ServiceAccount): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Sign with private key
  const key = await crypto.subtle.importKey(
    'pkcs8',
    str2ab(serviceAccount.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Obtiene un Access Token de Google OAuth 2.0
 */
export async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  const jwt = await createJWT(serviceAccount);

  const response = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data: AccessTokenResponse = await response.json();
  return data.access_token;
}

function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}
```

## Paso 3: Crear Edge Function para FCM v1

### 3.1 Nueva Edge Function: send-notification-fcm-v1

```typescript
// supabase/functions/send-notification-fcm-v1/index.ts

import { getAccessToken } from '../_shared/firebase-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotificationPayload {
  token: string; // FCM device token
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Obtener Service Account de secrets
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const projectId = serviceAccount.project_id;

    // Parse request body
    const payload: NotificationPayload = await req.json();

    // Validar token
    if (!payload.token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener Access Token de Google OAuth
    const accessToken = await getAccessToken(serviceAccount);

    // Construir mensaje FCM v1
    const message = {
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
            channelId: 'default',
            priority: 'high',
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
            },
          },
        },
      },
    };

    // Enviar a FCM v1 API
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('FCM Error:', result);
      return new Response(
        JSON.stringify({
          error: 'Failed to send notification',
          details: result
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Notification sent successfully:', result);

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
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

## Paso 4: Actualizar Cliente para Obtener FCM Token

### 4.1 Modificar NotificationContext.tsx

```typescript
// contexts/NotificationContext.tsx

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Función para obtener el FCM token (solo Android)
async function getFCMToken(): Promise<string | null> {
  if (Platform.OS !== 'android') {
    return null;
  }

  try {
    // Obtener el device push token nativo de Android
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

// En tu función de registro
async function registerForPushNotifications() {
  // ... código existente para permisos ...

  // Obtener Expo Push Token (para compatibilidad)
  const expoPushToken = await Notifications.getExpoPushTokenAsync({
    projectId: '0618d9ae-6714-46bb-adce-f4ee57fff324',
  });

  // NUEVO: Obtener FCM token para Android
  const fcmToken = await getFCMToken();

  // Guardar ambos tokens en la base de datos
  await supabase
    .from('profiles')
    .update({
      push_token: expoPushToken.data, // Para Expo Push Service (legacy)
      fcm_token: fcmToken,              // Para FCM v1 API
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}
```

### 4.2 Actualizar tabla profiles

```sql
-- Agregar columna para FCM token
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token
ON profiles(fcm_token)
WHERE fcm_token IS NOT NULL;
```

## Paso 5: Actualizar Funciones Existentes

### 5.1 Modificar send-scheduled-notifications

```typescript
// Función para enviar notificación usando FCM v1
async function sendNotificationV1(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-notification-fcm-v1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        token: fcmToken,
        title,
        body,
        data,
      }),
    }
  );

  return response.json();
}

// En el loop de notificaciones
for (const notification of pendingNotifications) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token, fcm_token')
    .eq('id', notification.user_id)
    .single();

  // Intentar con FCM v1 primero (si hay token)
  if (profile.fcm_token) {
    try {
      await sendNotificationV1(
        profile.fcm_token,
        notification.title,
        notification.body,
        notification.data
      );
      continue; // Éxito
    } catch (error) {
      console.warn('FCM v1 failed, falling back to legacy:', error);
    }
  }

  // Fallback a API heredada (Expo Push)
  if (profile.push_token) {
    // ... código existente con Expo Push Service ...
  }
}
```

## Paso 6: Testing

### 6.1 Script de Test

```javascript
// scripts/test-fcm-v1.js

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function testFCMv1() {
  // Obtener un token FCM de la base de datos
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token')
    .not('fcm_token', 'is', null)
    .limit(1)
    .single();

  if (!profile?.fcm_token) {
    console.error('No FCM token found');
    return;
  }

  console.log('Testing FCM v1 with token:', profile.fcm_token.substring(0, 20) + '...');

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/send-notification-fcm-v1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        token: profile.fcm_token,
        title: 'Test FCM v1',
        body: 'Esta es una notificación de prueba con FCM API v1',
        data: {
          test: 'true',
        },
      }),
    }
  );

  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

testFCMv1();
```

---

## 📊 Plan de Migración Completo

### Semana 1: Preparación
- [ ] Descargar Service Account JSON
- [ ] Configurar secrets en Supabase
- [ ] Crear helpers de autenticación
- [ ] Testing inicial

### Semana 2: Implementación
- [ ] Crear nueva Edge Function para FCM v1
- [ ] Actualizar cliente para obtener FCM token
- [ ] Actualizar base de datos (nueva columna)
- [ ] Testing en desarrollo

### Semana 3: Testing
- [ ] Testing exhaustivo iOS
- [ ] Testing exhaustivo Android
- [ ] Testing de fallback (legacy)
- [ ] Performance testing

### Semana 4: Migración Gradual
- [ ] Activar FCM v1 para 10% usuarios
- [ ] Monitorear errores
- [ ] Activar para 50% usuarios
- [ ] Activar para 100% usuarios

### Semana 5: Deprecación
- [ ] Remover código de API heredada
- [ ] Limpieza de código
- [ ] Documentación final

---

## ⚠️ Consideraciones Importantes

### 1. Tokens Diferentes

- **Expo Push Token**: `ExponentPushToken[xxx]`
- **FCM Token**: String largo (~150+ caracteres)

### 2. Compatibilidad

- iOS seguirá usando APNs (no cambia)
- Android usará FCM v1
- Mantener fallback a legacy durante migración

### 3. Rate Limits

- FCM v1: 600,000 requests/minute
- Más que suficiente para tu app

### 4. Costos

- FCM es completamente GRATIS
- Sin límites en número de mensajes

---

## 🎯 Recomendación Final

**Para AHORA (Hoy):**
```
Habilita la API heredada en Firebase Console
```

**Para PRÓXIMAMENTE (Próximas 4 semanas):**
```
Implementa FCM v1 siguiendo esta guía
```

**Ventajas de esta aproximación:**
1. ✅ Tu app funciona HOY
2. ✅ Migración gradual y segura
3. ✅ Mantienes compatibilidad durante transición
4. ✅ No hay downtime

---

¿Quieres que te ayude a implementar la migración a FCM v1 ahora, o prefieres primero habilitar la API heredada para que funcione inmediatamente?
