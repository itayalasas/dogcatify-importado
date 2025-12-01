import { supabaseClient } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { envConfig } from './envConfig';

// Get Supabase configuration from envConfig
const SUPABASE_URL = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Email API Configuration (using Supabase edge function)
const EMAIL_API_URL = `${SUPABASE_URL}/functions/v1/send-email`;
const EMAIL_API_KEY = SUPABASE_ANON_KEY;

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

/**
 * Get service role client for admin operations
 */
const getServiceClient = () => {
  const supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseServiceKey = envConfig.get('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseServiceKey) {
    console.warn('Service role key not available, using regular client');
    return supabaseClient;
  }
  
  return createClient(supabaseUrl!, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
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
    console.error('Error creating email confirmation token:', error);
    throw error;
  }
};

/**
 * Verify email confirmation token
 */
export const confirmEmailCustom = async (
  token: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<{ success: boolean; userId?: string; email?: string; error?: string }> => {
  try {
    console.log('Verifying token:', token, 'type:', type);

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
      console.error('Token not found at all:', anyTokenError);
      return { success: false, error: 'TOKEN_NOT_FOUND' };
    }

    if (!anyTokenData) {
      return { success: false, error: 'TOKEN_NOT_FOUND' };
    }

    // Check if token was already confirmed
    if (anyTokenData.is_confirmed) {
      console.log('Token already used:', {
        userId: anyTokenData.user_id,
        email: anyTokenData.email,
        confirmedAt: anyTokenData.confirmed_at
      });
      return { 
        success: false, 
        error: 'TOKEN_ALREADY_USED',
        userId: anyTokenData.user_id,
        email: anyTokenData.email
      };
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(anyTokenData.expires_at);
    
    if (now > expiresAt) {
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
      console.error('Error updating token:', updateError);
      return { success: false, error: 'UPDATE_ERROR' };
    }

    // CRITICAL: Update user in auth.users to mark email as confirmed
    console.log('Updating user in auth.users to mark email as confirmed...');
    const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(
      anyTokenData.user_id,
      { 
        email_confirm: true,
        user_metadata: {
          email_confirmed: true,
          email_confirmed_at: new Date().toISOString()
        }
      }
    );

    if (authUpdateError) {
      console.error('Error updating user in auth.users:', authUpdateError);
      // Don't fail the confirmation if auth update fails, but log it
      console.warn('Email confirmed in our system but not in auth.users');
    } else {
      console.log('✅ User email confirmed in auth.users successfully');
    }
    // Update user profile to mark email as confirmed
    const { error: profileError } = await serviceClient
      .from('profiles')
      .update({
        email_confirmed: true,
        email_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', anyTokenData.user_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail the confirmation if profile update fails
    }

    console.log('Email confirmation successful for user:', anyTokenData.user_id);

    return {
      success: true,
      userId: anyTokenData.user_id,
      email: anyTokenData.email
    };
  } catch (error) {
    console.error('Error verifying email confirmation token:', error);
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
 * Complete user registration after email confirmation
 * This creates the user profile and all necessary records
 */
export const completeUserRegistration = async (
  userId: string,
  email: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Completing user registration for:', userId);
    
    // Use service client to create profile
    const serviceClient = getServiceClient();
    
    // Create user profile
    const { error: profileError } = await serviceClient
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        display_name: displayName,
        is_owner: true,
        is_partner: false,
        email_confirmed: true,
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers: [],
        following: []
      });

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      return { success: false, error: 'Error creating user profile' };
    }

    console.log('User profile created successfully');
    
    // Here you can add other initial records if needed
    // For example: default settings, welcome notifications, etc.
    
    return { success: true };
  } catch (error) {
    console.error('Error completing user registration:', error);
    return { success: false, error: 'Internal error completing registration' };
  }
};
/**
 * Generate confirmation URL
 */
export const generateConfirmationUrl = (token: string, type: 'signup' | 'password_reset' = 'signup'): string => {
  const baseUrl = envConfig.getOrDefault('EXPO_PUBLIC_APP_DOMAIN', 'https://app-dogcatify.netlify.app');

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
  data: Record<string, any>
): Promise<{ success: boolean; error?: string; log_id?: string }> => {
  console.log(`📧 === SENDING ${templateName.toUpperCase()} EMAIL ===`);
  console.log('📧 Recipient:', recipientEmail);
  console.log('📧 Data:', JSON.stringify(data, null, 2));

  try {
    if (!EMAIL_API_URL || !EMAIL_API_KEY) {
      console.error('❌ Email API configuration missing!');
      return { success: false, error: 'Email API configuration missing' };
    }

    const emailPayload = {
      template_name: templateName,
      recipient_email: recipientEmail,
      data: data,
    };

    console.log('📧 Calling Supabase function:', EMAIL_API_URL);
    console.log('📧 Payload:', JSON.stringify(emailPayload, null, 2));

    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EMAIL_API_KEY}`,
        'apikey': EMAIL_API_KEY,
      },
      body: JSON.stringify(emailPayload),
    });

    console.log('📧 Response status:', response.status);

    const responseText = await response.text();
    console.log('📧 Response body:', responseText);

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
  return sendEmailViaSupabase('confirmation', email, {
    client_name: name,
    confirmation_url: confirmationUrl,
  });
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
    console.log('Resending confirmation email for:', email);

    // First try to find user in profiles table
    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, display_name')
      .eq('email', email)
      .maybeSingle();

    let userId: string | null = null;
    let displayName: string = 'Usuario';

    if (profileData) {
      userId = profileData.id;
      displayName = profileData.display_name || 'Usuario';
      console.log('Found user in profiles:', userId);
    } else {
      // If not found in profiles, try to find in auth.users using service client
      console.log('User not found in profiles, checking auth.users...');
      const serviceClient = getServiceClient();

      const { data: authUser, error: authError } = await serviceClient.auth.admin.listUsers();

      if (authError) {
        console.error('Error listing users from auth:', authError);
        return { success: false, error: 'Error buscando usuario' };
      }

      const foundUser = authUser.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!foundUser) {
        console.error('User not found in auth.users either');
        return { success: false, error: 'No existe una cuenta con este correo electrónico' };
      }

      userId = foundUser.id;
      displayName = (foundUser.user_metadata?.full_name as string) || 'Usuario';
      console.log('Found user in auth.users:', userId);

      // Create the missing profile
      console.log('Creating missing profile for user...');
      const { error: createProfileError } = await serviceClient
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          display_name: displayName,
          is_owner: true,
          is_partner: false,
          email_confirmed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createProfileError) {
        console.error('Error creating profile:', createProfileError);
        // Continue anyway, we can still send the email
      } else {
        console.log('Profile created successfully');
      }
    }

    console.log('Resending confirmation email for user:', userId);

    // Invalidate any existing signup tokens for this user
    const serviceClient = getServiceClient();
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
      console.warn('Could not invalidate existing tokens:', invalidateError);
    }

    // Create new confirmation token
    const token = await createEmailConfirmationToken(userId, email, 'signup');
    const confirmationUrl = generateConfirmationUrl(token, 'signup');

    console.log('New confirmation URL generated:', confirmationUrl);

    // Send confirmation email using new API
    const result = await sendConfirmationEmailAPI(
      email,
      displayName,
      confirmationUrl
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Error sending email' };
    }

    console.log('Confirmation email resent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error resending confirmation email:', error);
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