import { supabaseClient } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';

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
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
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
  const baseUrl = process.env.EXPO_PUBLIC_APP_DOMAIN || 
                  process.env.EXPO_PUBLIC_APP_URL || 
                  process.env.EXPO_PUBLIC_SUPABASE_URL?.replace('/v1', '') ||
                  'https://app-dogcatify.netlify.app';
  
  if (type === 'password_reset') {
    // Password reset goes to a SEPARATE reset password page
    return `${baseUrl}/auth/reset-password?token=${token}`;
  } else {
    // Email confirmation goes to the confirm page (ONLY for signup)
    return `${baseUrl}/auth/confirm?token_hash=${token}&type=signup`;
  }
};

/**
 * Resend confirmation email
 */
export const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('Resending confirmation email for:', email);
    
    // Find user by email
    const { data: userData, error: userError } = await supabaseClient
      .from('profiles')
      .select('id, display_name')
      .eq('email', email)
      .single();

    if (userError) {
      console.error('User not found for email resend:', userError);
      if (userError.code === 'PGRST116') {
        return { success: false, error: 'No existe una cuenta con este correo electrónico' };
      }
      return { success: false, error: 'Usuario no encontrado' };
    }

    console.log('Resending confirmation email for user:', userData.id);

    // Invalidate any existing signup tokens for this user
    const serviceClient = getServiceClient();
    const { error: invalidateError } = await serviceClient
      .from('email_confirmations')
      .update({ 
        is_confirmed: true,
        confirmed_at: new Date().toISOString()
      })
      .eq('user_id', userData.id)
      .eq('type', 'signup')
      .eq('is_confirmed', false);
    
    if (invalidateError) {
      console.warn('Could not invalidate existing tokens:', invalidateError);
    }

    // Create new confirmation token
    const token = await createEmailConfirmationToken(userData.id, email, 'signup');
    const confirmationUrl = generateConfirmationUrl(token, 'signup');

    console.log('New confirmation URL generated:', confirmationUrl);

    // Send confirmation email
    const { NotificationService } = await import('./notifications');
    await NotificationService.sendCustomConfirmationEmail(
      email,
      userData.display_name || 'Usuario',
      confirmationUrl
    );

    console.log('Confirmation email resent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error resending confirmation email:', error);
    return { success: false, error: 'Error al reenviar email de confirmación' };
  }
};