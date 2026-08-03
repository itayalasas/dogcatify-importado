import { supabaseClient } from '../lib/supabase';
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

type ProfileRoleFlags = {
  isOwner: boolean;
  isPartner: boolean;
  isAdmin: boolean;
};

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
      return baseUrl ? `${baseUrl}/functions/v1/${functionName}` : configuredUrl;
    }

    return configuredUrl;
  }

  if (baseUrl) {
    return `${baseUrl}/functions/v1/${functionName}`;
  }

  return configuredUrl;
};

const getPublicSupabaseKey = (): string => readEnvValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const parseMetadataBoolean = (value: any): boolean | undefined => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const resolveProfileRoleFlagsFromMetadata = (
  metadata: Record<string, any> | null | undefined,
  existing?: Partial<ProfileRoleFlags> | null,
): ProfileRoleFlags => {
  const accountRole = String(metadata?.account_role || '').toLowerCase();
  const explicitOwner = parseMetadataBoolean(metadata?.is_owner);
  const explicitPartner = parseMetadataBoolean(metadata?.is_partner);
  const explicitAdmin = parseMetadataBoolean(metadata?.is_admin);
  const currentOwner = existing?.isOwner ?? true;
  const currentPartner = existing?.isPartner ?? false;
  const currentAdmin = existing?.isAdmin ?? false;

  if (accountRole === 'partner') {
    return {
      isOwner: existing ? currentOwner : false,
      isPartner: true,
      isAdmin: explicitAdmin ?? currentAdmin,
    };
  }

  if (accountRole === 'admin') {
    return {
      isOwner: explicitOwner ?? currentOwner,
      isPartner: explicitPartner ?? currentPartner,
      isAdmin: true,
    };
  }

  if (accountRole === 'owner') {
    return {
      isOwner: true,
      isPartner: existing ? currentPartner : false,
      isAdmin: explicitAdmin ?? currentAdmin,
    };
  }

  return {
    isOwner: explicitOwner ?? currentOwner,
    isPartner: explicitPartner ?? currentPartner,
    isAdmin: explicitAdmin ?? currentAdmin,
  };
};

const getRoleFlagsFromAuthUser = async (
  serviceClient: any,
  userId: string,
  existing?: Partial<ProfileRoleFlags> | null,
): Promise<ProfileRoleFlags> => {
  try {
    if (serviceClient?.auth?.admin?.getUserById) {
      const { data, error } = await serviceClient.auth.admin.getUserById(userId);

      if (!error && data?.user) {
        return resolveProfileRoleFlagsFromMetadata(data.user.user_metadata, existing);
      }
    }
  } catch (error) {
  }

  return {
    isOwner: true,
    isPartner: false,
    isAdmin: false,
  };
};

const parseJsonSafely = (value: string): any | null => {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const extractTokenFromConfirmationUrl = (confirmationUrl: string): string | null => {
  try {
    const url = new URL(confirmationUrl);
    return url.searchParams.get('token_hash') || url.searchParams.get('token');
  } catch (error) {
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
      return null;
    }


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


    if (!response.ok && response.status === 404 && parsedBody?.error === 'TOKEN_NOT_FOUND') {
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
  throw new Error('Token creation is only available on the server');
};

/**
 * Verify email confirmation token
 */
export const confirmEmailCustomLegacy = async (
  token: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<ConfirmEmailApiResult> => {
  return confirmEmailCustom(token, type);
};

export const confirmEmailCustom = async (
  token: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<ConfirmEmailApiResult> => {
  try {
    await ensureRuntimeEnvConfig(true);
    const edgeResult = await confirmEmailViaEdgeFunction(token, type);
    return edgeResult || { success: false, error: 'CONFIRMATION_SERVICE_UNAVAILABLE' };
  } catch (error) {
    return { success: false, error: 'INTERNAL_ERROR' };
  }
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
      return false;
    }

    return data?.email_confirmed || false;
  } catch (error) {
    return false;
  }
};

/**
 * Complete user registration after email confirmation
 * This creates the user profile and all necessary records
 */
export const completeUserRegistration = async (
  userId: string,
  email: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        display_name: displayName,
        is_owner: true,
        is_partner: false,
        is_admin: false,
        email_confirmed: true,
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers: [],
        following: []
      });

    if (profileError) {
      return { success: false, error: 'Error creating user profile' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Internal error completing registration' };
  }
};
/**
 * Generate confirmation URL
 */
export const generateConfirmationUrl = (token: string, type: 'signup' | 'password_reset' = 'signup'): string => {
  const baseUrl = envConfig.getOrDefault('EXPO_PUBLIC_APP_DOMAIN', 'https://app.dogcatify.com');


  if (type === 'password_reset') {
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;
    return resetUrl;
  } else {
    const confirmUrl = `${baseUrl}/auth/confirm?token_hash=${token}&type=signup`;
    return confirmUrl;
  }
};

export const requestEmailConfirmation = async (
  email: string,
  type: 'signup' | 'password_reset' = 'signup',
  userId?: string,
  displayName?: string,
): Promise<{ success: boolean; error?: string; log_id?: string }> => {
  await ensureRuntimeEnvConfig();

  const supabaseUrl = getSupabaseBaseUrl();
  const anonKey = getPublicSupabaseKey();
  if (!supabaseUrl || !anonKey) {
    return { success: false, error: 'PUBLIC_CONFIG_UNAVAILABLE' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/request-email-confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email, type, userId, displayName }),
    });
    const result = parseJsonSafely(await response.text()) || {};

    if (!response.ok || result.success === false) {
      return { success: false, error: result.error || 'EMAIL_REQUEST_FAILED' };
    }

    return { success: true, log_id: result.log_id };
  } catch {
    return { success: false, error: 'EMAIL_REQUEST_FAILED' };
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

  const emailApiUrl = resolveSupabaseFunctionUrl('send-email', 'EXPO_PUBLIC_EMAIL_API_URL');
  const anonKey = getPublicSupabaseKey();
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const accessToken = sessionData.session?.access_token || anonKey;

  if (!emailApiUrl || !anonKey) {
    return { success: false, error: 'EMAIL_API_URL not configured' };
  }



  try {
    const emailPayload = {
      template_name: templateName,
      recipient_email: recipientEmail,
      data: data,
      ...extraPayload,
    };


    const response = await fetch(emailApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': anonKey,
      },
      body: JSON.stringify(emailPayload),
    });


    const responseText = await response.text();

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status} - ${responseText}` };
    }

    try {
      const result = JSON.parse(responseText);
      return { success: true, log_id: result.log_id };
    } catch (parseError) {
      return { success: true };
    }
  } catch (error: any) {
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
export const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  return requestEmailConfirmation(email, 'signup');
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
