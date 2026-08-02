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

function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalizedPem = pem
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\r/g, '\n');

  const pemContents = normalizedPem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');

  if (!pemContents || pemContents.length < 100) {
    throw new Error('Invalid Firebase private key format: key body is empty or too short');
  }

  let normalizedBase64 = pemContents
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const padding = normalizedBase64.length % 4;
  if (padding > 0) {
    normalizedBase64 += '='.repeat(4 - padding);
  }

  let binaryString: string;
  try {
    binaryString = atob(normalizedBase64);
  } catch {
    throw new Error(
      'Invalid Firebase private key format: base64 decode failed. Verify FIREBASE_PRIVATE_KEY with full PEM content and correct newline escaping.'
    );
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

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

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const keyData = pemToArrayBuffer(serviceAccount.private_key);

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
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

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${unsignedToken}.${encodedSignature}`;
}

export async function getAccessToken(serviceAccount: ServiceAccount): Promise<string> {
  try {
    const jwt = await createJWT(serviceAccount);

    const response = await fetch(serviceAccount.token_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
    }

    const data: AccessTokenResponse = await response.json();
    return data.access_token;
  } catch (error) {
    throw error;
  }
}

export function parseServiceAccount(serviceAccountJson: string): ServiceAccount {
  try {
    return JSON.parse(serviceAccountJson);
  } catch (error) {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON format');
  }
}
