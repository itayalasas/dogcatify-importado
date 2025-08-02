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
export const verifyEmailConfirmationToken = async (
  token: string,
  type: 'signup' | 'password_reset' = 'signup'
): Promise<{ success: boolean; userId?: string; email?: string; error?: string }> => {
  try {
    console.log('Verifying token:', token, 'type:', type);

    // Find the token in database
    const { data: tokenData, error } = await supabaseClient
      .from('email_confirmations')
      .select('*')
      .eq('token_hash', token)
      .eq('type', type)
      .eq('is_confirmed', false)
      .single();

    if (error) {
      console.error('Error finding token:', error);
      return { success: false, error: 'Token no encontrado o ya utilizado' };
    }

    if (!tokenData) {
      return { success: false, error: 'Token no válido' };
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    
    if (now > expiresAt) {
      return { success: false, error: 'Token expirado' };
    }

    // Mark token as confirmed
    // Use service client to bypass RLS for token verification
    const serviceClient = getServiceClient();
    const { error: updateError } = await serviceClient
      .from('email_confirmations')
      .update({
        is_confirmed: true,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', tokenData.id);

    if (updateError) {
      console.error('Error updating token:', updateError);
      return { success: false, error: 'Error al confirmar token' };
    }

    // Update user profile to mark email as confirmed
    const { error: profileError } = await serviceClient
      .from('profiles')
      .update({
        email_confirmed: true,
        email_confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', tokenData.user_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail the confirmation if profile update fails
    }

    console.log('Email confirmation successful for user:', tokenData.user_id);

    return {
      success: true,
      userId: tokenData.user_id,
      email: tokenData.email
    };
  } catch (error) {
    console.error('Error verifying email confirmation token:', error);
    return { success: false, error: 'Error interno del servidor' };
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
 * Generate confirmation URL
 */
export const generateConfirmationUrl = (token: string, type: 'signup' | 'password_reset' = 'signup'): string => {
  const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081';
  return `${baseUrl}/auth/confirm?token_hash=${token}&type=${type}`;
};

/**
 * Resend confirmation email
 */
export const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Find user by email
    const { data: userData, error: userError } = await supabaseClient
      .from('profiles')
      .select('id, display_name, email_confirmed')
      .eq('email', email)
      .single();

    if (userError) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    if (userData.email_confirmed) {
      return { success: false, error: 'El email ya está confirmado' };
    }

    // Invalidate any existing tokens for this user
    // Use service client to bypass RLS
    const serviceClient = getServiceClient();
    await serviceClient
      .from('email_confirmations')
      .update({ is_confirmed: true })
      .eq('user_id', userData.id)
      .eq('type', 'signup')
      .eq('is_confirmed', false);

    // Create new confirmation token
    const token = await createEmailConfirmationToken(userData.id, email, 'signup');
    const confirmationUrl = generateConfirmationUrl(token, 'signup');

    // Send confirmation email
    const { NotificationService } = await import('./notifications');
    await NotificationService.sendCustomConfirmationEmail(
      email,
      userData.display_name || 'Usuario',
      confirmationUrl
    );

    return { success: true };
  } catch (error) {
    console.error('Error resending confirmation email:', error);
    return { success: false, error: 'Error al reenviar email de confirmación' };
  }
};