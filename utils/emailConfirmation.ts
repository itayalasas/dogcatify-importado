import { supabaseClient } from '../lib/supabase';
import { getAppConfig } from './appConfig';
import { envConfig } from './envConfig';

export interface EmailConfirmationToken {
  id: string;
  user_id: string;
  email: string;
  token_hash: string;
  type: 'signup' | 'password_reset';
  is_confirmed: boolean;
  expires_at: string;
  created_at: string;
}

type ConfirmEmailApiResult = {
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
  confirmedAt?: string;
  alreadyConfirmed?: boolean;
  tokenUpdateWarning?: boolean;
};

const trimTrailingSlash = (value: string) => String(value || '').trim().replace(/\/+$/, '');

const ensureRuntimeEnvConfig = async (forceRefresh = false): Promise<void> => {
  if (forceRefresh) {
    await envConfig.reload();
    return;
  }

  if (!envConfig.isInitialized()) {
    await envConfig.initialize();
  }
};

const readEnvValue = (key: string): string => {
  return String(envConfig.get(key) || '').trim();
};

const getSupabaseBaseUrl = (): string => {
  return trimTrailingSlash(readEnvValue('EXPO_PUBLIC_SUPABASE_URL'));
};

const sameSupabaseHost = (candidateUrl: string, baseUrl: string): boolean => {
  try {
    return new URL(candidateUrl).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
};

const isSupabaseFunctionsUrl = (candidateUrl: string): boolean => {
  try {
    const parsed = new URL(candidateUrl);
    return parsed.host.endsWith('.supabase.co') && parsed.pathname.includes('/functions/v1/');
  } catch {
    return false;
  }
};

const matchesSupabaseFunctionPath = (candidateUrl: string, functionName: 'send-email' | 'confirm-email'): boolean => {
  try {
    const parsed = new URL(candidateUrl);
    return parsed.pathname.replace(/\/+$/, '') === `/functions/v1/${functionName}`;
  } catch {
    return false;
  }
};

const resolveSupabaseFunctionUrl = (
  functionName: 'send-email' | 'confirm-email',
  envKey: 'EXPO_PUBLIC_EMAIL_API_URL' | 'EXPO_PUBLIC_CONFIRM_EMAIL_API_URL',
): string => {
  const baseUrl = getSupabaseBaseUrl();
  const configuredUrl = trimTrailingSlash(readEnvValue(envKey));

  if (configuredUrl) {
    if (
      isSupabaseFunctionsUrl(configuredUrl) &&
      (
        (baseUrl && !sameSupabaseHost(configuredUrl, baseUrl)) ||
        !matchesSupabaseFunctionPath(configuredUrl, functionName)
      )
    ) {
      console.warn(
        `[emailConfirmation] ${envKey} does not point to the current ${functionName} endpoint. Using current project fallback instead:`,
        configuredUrl,
      );
      return baseUrl ? `${baseUrl}/functions/v1/${functionName}` : configuredUrl;
    }

    return configuredUrl;
  }

  if (baseUrl) {
    return `${baseUrl}/functions/v1/${functionName}`;
  }

  return configuredUrl;
};

const getEmailApiKey = (): string => {
  return (
    readEnvValue('EXPO_PUBLIC_EMAIL_API_KEY') ||
    readEnvValue('EXPO_PUBLIC_SUPABASE_ANON_KEY')
  );
};

const parseJsonSafely = (value: string): any | null => {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Could not parse JSON response from confirm-email edge function:', error);
    return null;
  }
};

const extractTokenFromConfirmationUrl = (confirmationUrl: string): string | null => {
  try {
    const url = new URL(confirmationUrl);
    return url.searchParams.get('token_hash') || url.searchParams.get('token');
  } catch (error) {
    console.warn('Could not extract token from confirmation URL:', error);
    return null;
  }
};

const confirmEmailViaEdgeFunction = async (
  token: string,
  type: 'signup' | 'password_reset',
): Promise<ConfirmEmailApiResult | null> => {
  try {
    await ensureRuntimeEnvConfig(true);

    const confirmEmailApiUrl = resolveSupabaseFunctionUrl('confirm-email', 'EXPO_PUBLIC_CONFIRM_EMAIL_API_URL');

    if (!confirmEmailApiUrl) {
      console.warn('confirm-email URL could not be resolved');
      return null;
    }

    console.log('[emailConfirmation] confirm-email resolved target:', {
      confirmEmailApiUrl,
      source: envConfig.get('EXPO_PUBLIC_CONFIRM_EMAIL_API_URL') ? 'envConfig' : 'fallback-current-project',
    });

    const response = await fetch(confirmEmailApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        type,
      }),
    });

    const responseText = await response.text();
    const parsedBody = parseJsonSafely(responseText);

    console.log('[emailConfirmation] confirm-email edge response:', {
      url: confirmEmailApiUrl,
      status: response.status,
      ok: response.ok,
      hasParsedBody: !!parsedBody,
      parsedError: parsedBody?.error || null,
    });

    if (!response.ok && response.status === 404 && parsedBody?.error === 'TOKEN_NOT_FOUND') {
      console.warn('[emailConfirmation] confirm-email returned TOKEN_NOT_FOUND, trying local confirmation fallback');
      return null;
    }

    if (parsedBody && (typeof parsedBody.success === 'boolean' || parsedBody.error)) {
      return parsedBody as ConfirmEmailApiResult;
    }

    if (!response.ok && response.status === 404) {
      return null;
    }

    if (response.ok) {
      return {
        success: true,
        userId: parsedBody?.userId,
        email: parsedBody?.email,
        confirmedAt: parsedBody?.confirmedAt,
      };
    }

    return {
      success: false,
      error: parsedBody?.error || 'CONFIRMATION_FAILED',
      userId: parsedBody?.userId,
      email: parsedBody?.email,
      confirmedAt: parsedBody?.confirmedAt,
    };
  } catch (error) {
    console.warn('confirm-email edge function unavailable, falling back to local confirmation flow:', error);
    return null;
  }
};

/**
 * Generate a secure token for email confirmation
 */
export const generateConfirmationToken = async (): Promise<string> => {
  // Generate a random token using Math.random for compatibility
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  return token;
};

/**
 * Create email confirmation token in database
 */
export const createEmailConfirmationToken = async (
  userId: string,
  email: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<string> => {
  if (type !== 'signup') {
    throw new Error('createEmailConfirmationToken only supports type "signup" — use requestPasswordReset() for password resets.');
  }

  try {
    await ensureRuntimeEnvConfig(true);

    const { data, error } = await supabaseClient.functions.invoke('manage-email-confirmation', {
      body: { action: 'create-token', userId, email },
    });

    if (error || !data?.success || !data?.token) {
      throw error || new Error(data?.error || 'TOKEN_CREATE_FAILED');
    }

    return data.token as string;
  } catch (error) {
    console.error('Error creating email confirmation token:', error);
    throw error;
  }
};

/**
 * Verify email confirmation token. The confirm-email edge function does the
 * actual work server-side (service_role, admin.* calls) — this just relays
 * its result. There is intentionally no client-side fallback anymore: it
 * used to re-run the same logic locally with a service_role key shipped in
 * the app bundle, which is exactly the exposure this removes.
 */
export const confirmEmailCustom = async (
  token: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<ConfirmEmailApiResult> => {
  await ensureRuntimeEnvConfig(true);

  console.log('Verifying token:', token, 'type:', type);

  const edgeResult = await confirmEmailViaEdgeFunction(token, type);
  if (edgeResult) {
    console.log('confirm-email edge function result:', edgeResult);
    return edgeResult;
  }

  console.error('confirm-email edge function unavailable and returned no result');
  return { success: false, error: 'CONFIRMATION_UNAVAILABLE' };
};

/**
 * Check if user's email is confirmed
 */
export const isEmailConfirmed = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('email_confirmed')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error checking email confirmation:', error);
      return false;
    }

    return data?.email_confirmed || false;
  } catch (error) {
    console.error('Error checking email confirmation:', error);
    return false;
  }
};

/**
 * Generate confirmation URL
 */
export const generateConfirmationUrl = (token: string, type: 'signup' | 'password_reset' = 'signup'): string => {
  const baseUrl = envConfig.getOrDefault('EXPO_PUBLIC_APP_DOMAIN', 'https://app.dogcatify.com');

  console.log('🔗 Generating confirmation URL with base:', baseUrl);
  console.log('🔗 Token type:', type);

  if (type === 'password_reset') {
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
    console.log('🔗 Password reset URL:', resetUrl);
    return resetUrl;
  } else {
    const confirmUrl = `${baseUrl}/auth/confirm?token_hash=${token}&type=signup`;
    console.log('🔗 Email confirmation URL:', confirmUrl);
    return confirmUrl;
  }
};

/**
 * Base function to send emails via Supabase edge function
 */
const sendEmailViaSupabase = async (
  templateName: string,
  recipientEmail: string,
  data: Record<string, any>,
  extraPayload: Record<string, any> = {},
): Promise<{ success: boolean; error?: string; log_id?: string }> => {
  await ensureRuntimeEnvConfig();

  const appConfig = await getAppConfig(true).catch((error) => {
    console.warn('[emailConfirmation] Could not load app config for email dispatch, using env fallback:', error);
    return null;
  });

  const configEmailApiUrl = trimTrailingSlash(String(appConfig?.email_api_url || ''));
  const configEmailApiKey = String(appConfig?.email_api_key || '').trim();
  const fallbackEmailApiUrl = resolveSupabaseFunctionUrl('send-email', 'EXPO_PUBLIC_EMAIL_API_URL');
  const fallbackEmailApiKey = getEmailApiKey();
  const emailApiUrl = configEmailApiUrl || fallbackEmailApiUrl;
  const emailApiKey = configEmailApiKey || fallbackEmailApiKey;

  if (!emailApiUrl) {
    return { success: false, error: 'EMAIL_API_URL not configured' };
  }

  console.log('[emailConfirmation] Resolved email API target:', {
    emailApiUrl,
    source: configEmailApiUrl ? 'app_config' : 'env_or_fallback',
    fallbackUrl: fallbackEmailApiUrl || null,
  });

  console.log(`📧 === SENDING ${templateName.toUpperCase()} EMAIL ===`);
  console.log('📧 Recipient:', recipientEmail);
  console.log('📧 Data:', JSON.stringify(data, null, 2));
  console.log('[emailConfirmation] Email dispatch configuration:', {
    emailApiUrl,
    configSource: configEmailApiUrl ? 'app_config' : 'env_or_fallback',
    hasEmailApiKey: !!emailApiKey,
    emailApiKeySource: configEmailApiKey ? 'app_config' : 'env_or_fallback',
  });

  try {
    /*if (!EMAIL_API_URL || !EMAIL_API_KEY) {
      console.error('❌ Email API configuration missing!');
      return { success: false, error: 'Email API configuration missing' };
    }*/

    const emailPayload = {
      template_name: templateName,
      recipient_email: recipientEmail,
      data: data,
      ...extraPayload,
    };

    console.log('📧 Calling Supabase function:', emailApiUrl);
    console.log('📧 Payload:', JSON.stringify(emailPayload, null, 2));

    const response = await fetch(emailApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${emailApiKey}`,
        'apikey': emailApiKey,
      },
      body: JSON.stringify(emailPayload),
    });

    console.log('📧 Response status:', response.status);

    const responseText = await response.text();
    console.log('📧 Response body preview:', responseText.slice(0, 1000));

    if (!response.ok) {
      console.error('❌ Email API error:', response.status, responseText);
      return { success: false, error: `API error: ${response.status} - ${responseText}` };
    }

    try {
      const result = JSON.parse(responseText);
      console.log('✅ Email sent successfully!');
      return { success: true, log_id: result.log_id };
    } catch (parseError) {
      console.warn('⚠️ Could not parse response as JSON, but request succeeded');
      return { success: true };
    }
  } catch (error: any) {
    console.error('❌ Error sending email:', error);
    console.error('❌ Error stack:', error.stack);
    return { success: false, error: error.message || 'Unknown error' };
  }
};

/**
 * Send confirmation email
 */
export const sendConfirmationEmailAPI = async (
  email: string,
  name: string,
  confirmationUrl: string
): Promise<{ success: boolean; error?: string; log_id?: string }> => {
  const confirmationToken = extractTokenFromConfirmationUrl(confirmationUrl);

  return sendEmailViaSupabase('confirmation', email, {
    client_name: name,
    confirmation_url: confirmationUrl,
    token: confirmationToken,
    token_hash: confirmationToken,
  }, confirmationToken ? {
    token: confirmationToken,
    token_hash: confirmationToken,
  } : {});
};

/**
 * Send welcome email
 */
export const sendWelcomeEmailAPI = async (
  email: string,
  name: string
): Promise<{ success: boolean; error?: string; log_id?: string }> => {
  return sendEmailViaSupabase('welcome', email, {
    client_name: name,
    cta_url: 'dogcatify://perfil',
  });
};

/**
 * Resend confirmation email
 */
/**
 * Resend the signup confirmation email. Runs entirely server-side now (the
 * manage-email-confirmation edge function finds-or-creates the profile,
 * syncs role flags, invalidates old tokens, issues a new one, and sends the
 * email) — the raw token never reaches this client.
 */
export const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await ensureRuntimeEnvConfig();

    console.log('Resending confirmation email for:', email);

    const { data, error } = await supabaseClient.functions.invoke('manage-email-confirmation', {
      body: { action: 'resend', email },
    });

    if (error || !data?.success) {
      const message = data?.error === 'USER_NOT_FOUND'
        ? 'No existe una cuenta con este correo electrónico'
        : (data?.error || 'Error al reenviar email de confirmación');
      console.error('Error resending confirmation email:', message);
      return { success: false, error: message };
    }

    console.log('Confirmation email resent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error resending confirmation email:', error);
    return { success: false, error: 'Error al reenviar email de confirmación' };
  }
};

/**
 * Request a password reset email. Runs entirely server-side (creates the
 * token and sends the email in one step) — no raw token is ever returned to
 * the client, which closes the account-takeover vector that existed when
 * this flow ran client-side with a service_role key.
 */
export const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await ensureRuntimeEnvConfig();

    const { data, error } = await supabaseClient.functions.invoke('manage-email-confirmation', {
      body: { action: 'password-reset', email },
    });

    if (error || !data?.success) {
      const message = data?.error === 'USER_NOT_FOUND'
        ? 'No existe una cuenta con este correo electrónico'
        : (data?.error || 'Error al enviar el correo de restablecimiento');
      return { success: false, error: message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return { success: false, error: 'Error al enviar el correo de restablecimiento' };
  }
};

/**
 * Send welcome email to partner when their business is approved by admin
 */
export const sendPartnerWelcomeEmailAPI = async (
  partnerEmail: string,
  partnerName: string,
  businessName: string
): Promise<{ success: boolean; error?: string; log_id?: string }> => {
  return sendEmailViaSupabase('welcome-partner', partnerEmail, {
    partner_name: partnerName,
    business_name: businessName,
  });
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmailAPI = async (
  email: string,
  clientName: string,
  resetUrl: string
): Promise<{ success: boolean; error?: string; log_id?: string }> => {
  return sendEmailViaSupabase('reset-password', email, {
    client_name: clientName,
    reset_url: resetUrl,
  });
};
