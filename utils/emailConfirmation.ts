import { supabaseClient } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
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

const getEmailApiKey = (): string => {
  return (
    readEnvValue('EXPO_PUBLIC_EMAIL_API_KEY') ||
    readEnvValue('EXPO_PUBLIC_SUPABASE_ANON_KEY')
  );
};

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

/**
 * Get service role client for admin operations
 */
const getServiceClient = () => {
  const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseServiceKey = envConfig.get('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseServiceKey) {
    return supabaseClient;
  }
  
  return createClient(supabaseUrl!, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
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
  try {
    await ensureRuntimeEnvConfig(true);

    const token = await generateConfirmationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

    // Use service client to bypass RLS for token creation
    const serviceClient = getServiceClient();
    const { error } = await serviceClient
      .from('email_confirmations')
      .insert({
        user_id: userId,
        email: email,
        token_hash: token,
        type: type,
        is_confirmed: false,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return token;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify email confirmation token
 */
export const confirmEmailCustomLegacy = async (
  token: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<ConfirmEmailApiResult> => {
  try {
    await ensureRuntimeEnvConfig(true);


    const edgeResult = await confirmEmailViaEdgeFunction(token, type);
    if (edgeResult) {
      return edgeResult;
    }

    // Find the token in database using service client to bypass RLS
    const serviceClient = getServiceClient();
    
    // First, check if token exists at all (including already confirmed ones)
    const { data: anyTokenData, error: anyTokenError } = await serviceClient
      .from('email_confirmations')
      .select('*')
      .eq('token_hash', token)
      .eq('type', type)
      .single();

    if (anyTokenError) {
      return { success: false, error: 'TOKEN_NOT_FOUND' };
    }

    if (!anyTokenData) {
      return { success: false, error: 'TOKEN_NOT_FOUND' };
    }

    const tokenAlreadyUsed = Boolean(anyTokenData.is_confirmed);

    if (tokenAlreadyUsed) {
    }

    // Check if token has expired. Already-confirmed tokens are allowed to pass.
    const now = new Date();
    const expiresAt = new Date(anyTokenData.expires_at);
    
    if (!tokenAlreadyUsed && now > expiresAt) {
      return { 
        success: false, 
        error: 'TOKEN_EXPIRED',
        userId: anyTokenData.user_id,
        email: anyTokenData.email
      };
    }

    // Mark token as confirmed
    const { error: updateError } = await serviceClient
      .from('email_confirmations')
      .update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', anyTokenData.id);

    if (updateError) {
    }

    // CRITICAL: Update user in auth.users to mark email as confirmed
    const { data: authUserData } = await serviceClient.auth.admin.getUserById(anyTokenData.user_id);
    const existingAuthMetadata = authUserData?.user?.user_metadata || {};
    const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(
      anyTokenData.user_id,
      { 
        email_confirm: true,
        user_metadata: {
          ...existingAuthMetadata,
          email_confirmed: true,
          email_confirmed_at: new Date().toISOString()
        }
      }
    );

    if (authUpdateError) {
      // Don't fail the confirmation if auth update fails, but log it
    } else {
    }
    // Update user profile to mark email as confirmed
    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('is_owner, is_partner, is_admin')
      .eq('id', anyTokenData.user_id)
      .maybeSingle();

    const roleFlags = await getRoleFlagsFromAuthUser(
      serviceClient,
      anyTokenData.user_id,
      existingProfile
        ? {
            isOwner: existingProfile.is_owner ?? true,
            isPartner: existingProfile.is_partner ?? false,
            isAdmin: existingProfile.is_admin ?? false,
          }
        : null,
    );

    const { error: profileError } = await serviceClient
      .from('profiles')
      .update({
        is_owner: roleFlags.isOwner,
        is_partner: roleFlags.isPartner,
        is_admin: roleFlags.isAdmin,
        email_confirmed: true,
        email_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', anyTokenData.user_id);

    if (profileError) {
      // Don't fail the confirmation if profile update fails
    }


    return {
      success: true,
      userId: anyTokenData.user_id,
      email: anyTokenData.email,
      alreadyConfirmed: tokenAlreadyUsed,
    };
  } catch (error) {
    return { success: false, error: 'INTERNAL_ERROR' };
  }
};

export const confirmEmailCustom = async (
  token: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<ConfirmEmailApiResult> => {
  try {
    await ensureRuntimeEnvConfig(true);


    const edgeResult = await confirmEmailViaEdgeFunction(token, type);
    if (edgeResult) {
      return edgeResult;
    }

    const serviceClient = getServiceClient();
    const { data: confirmationRows, error: confirmationError } = await serviceClient.rpc(
      'confirm_email_signup_atomically',
      {
        p_token_hash: token,
        p_type: type,
      },
    ) as { data: any[] | null; error: any };

    if (confirmationError || !confirmationRows?.length) {
      const rawMessage = String(
        confirmationError?.message ||
          confirmationError?.details ||
          confirmationError?.hint ||
          'CONFIRMATION_TRANSACTION_FAILED',
      ).toUpperCase();

      if (rawMessage.includes('TOKEN_NOT_FOUND')) {
        return { success: false, error: 'TOKEN_NOT_FOUND' };
      }

      if (rawMessage.includes('TOKEN_EXPIRED')) {
        return { success: false, error: 'TOKEN_EXPIRED' };
      }

      if (rawMessage.includes('TOKEN_REQUIRED')) {
        return { success: false, error: 'TOKEN_REQUIRED' };
      }

      if (rawMessage.includes('PROFILE_NOT_FOUND')) {
        return { success: false, error: 'PROFILE_NOT_FOUND' };
      }


      return { success: false, error: 'CONFIRMATION_TRANSACTION_FAILED' };
    }

    const confirmation = confirmationRows[0];

    let authMetadata: Record<string, any> = {};
    try {
      const { data: authUserData } = await serviceClient.auth.admin.getUserById(confirmation.user_id);
      authMetadata = authUserData?.user?.user_metadata || {};
    } catch (error) {
    }

    const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(
      confirmation.user_id,
      {
        email_confirm: true,
        user_metadata: {
          ...authMetadata,
          email_confirmed: true,
          email_confirmed_at: confirmation.confirmed_at,
        },
      },
    );

    if (authUpdateError) {
      return {
        success: false,
        error: 'AUTH_UPDATE_ERROR',
        userId: confirmation.user_id,
        email: confirmation.email,
        alreadyConfirmed: confirmation.already_confirmed,
        confirmedAt: confirmation.confirmed_at,
      };
    }


    return {
      success: true,
      userId: confirmation.user_id,
      email: confirmation.email,
      alreadyConfirmed: confirmation.already_confirmed,
      confirmedAt: confirmation.confirmed_at,
    };
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
    
    // Use service client to create profile
    const serviceClient = getServiceClient();
    const roleFlags = await getRoleFlagsFromAuthUser(serviceClient, userId);
    
    // Create user profile
    const { error: profileError } = await serviceClient
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        display_name: displayName,
        is_owner: roleFlags.isOwner,
        is_partner: roleFlags.isPartner,
        is_admin: roleFlags.isAdmin,
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

    
    // Here you can add other initial records if needed
    // For example: default settings, welcome notifications, etc.
    
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
        'Authorization': `Bearer ${emailApiKey}`,
        'apikey': emailApiKey,
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
  try {
    await ensureRuntimeEnvConfig();

    const serviceClient = getServiceClient();

    // First try to find user in profiles table
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, display_name, is_owner, is_partner, is_admin')
      .eq('email', email)
      .maybeSingle();

    let userId: string | null = null;
    let displayName: string = 'Usuario';

    if (profileData) {
      userId = profileData.id;
      displayName = profileData.display_name || 'Usuario';
    } else {
      // If not found in profiles, try to find in auth.users using service client
      const serviceClient = getServiceClient();

      const { data: authUser, error: authError } = await serviceClient.auth.admin.listUsers();

      if (authError) {
        return { success: false, error: 'Error buscando usuario' };
      }

      const foundUser = authUser.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!foundUser) {
        return { success: false, error: 'No existe una cuenta con este correo electrónico' };
      }

      userId = foundUser.id;
      displayName = (foundUser.user_metadata?.full_name as string) || 'Usuario';
      const roleFlags = resolveProfileRoleFlagsFromMetadata(foundUser.user_metadata, null);

      // Create the missing profile
      const { error: createProfileError } = await serviceClient
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          display_name: displayName,
          is_owner: roleFlags.isOwner,
          is_partner: roleFlags.isPartner,
          is_admin: roleFlags.isAdmin,
          email_confirmed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createProfileError) {
        // Continue anyway, we can still send the email
      } else {
      }
    }

    if (!userId) {
      return { success: false, error: 'No se pudo determinar el usuario para reenviar la confirmación' };
    }

    try {
      const roleFlags = await getRoleFlagsFromAuthUser(
        serviceClient,
        userId,
        profileData
          ? {
              isOwner: profileData.is_owner ?? true,
              isPartner: profileData.is_partner ?? false,
              isAdmin: profileData.is_admin ?? false,
            }
          : null,
      );
      const { error: roleSyncError } = await serviceClient
        .from('profiles')
        .update({
          is_owner: roleFlags.isOwner,
          is_partner: roleFlags.isPartner,
          is_admin: roleFlags.isAdmin,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (roleSyncError) {
      }
    } catch (syncError) {
    }


    // Invalidate any existing signup tokens for this user
    const { error: invalidateError } = await serviceClient
      .from('email_confirmations')
      .update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('type', 'signup')
      .eq('is_confirmed', false);

    if (invalidateError) {
    }

    // Create new confirmation token
    const token = await createEmailConfirmationToken(userId, email, 'signup');
    const confirmationUrl = generateConfirmationUrl(token, 'signup');


    // Send confirmation email using new API
    const result = await sendConfirmationEmailAPI(
      email,
      displayName,
      confirmationUrl
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Error sending email' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al reenviar email de confirmación' };
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
