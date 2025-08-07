import { supabaseClient } from '../lib/supabase';

export interface MedicalHistoryToken {
  id: string;
  pet_id: string;
  token: string;
  expires_at: string;
  created_by: string;
  accessed_at?: string;
  access_count: number;
  created_at: string;
}

/**
 * Generate a secure random token for medical history access
 */
const generateSecureToken = (): string => {
  // Generate a secure random token compatible with React Native
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2);
  const randomPart2 = Math.random().toString(36).substring(2);
  const randomPart3 = Math.random().toString(36).substring(2);
  
  // Combine parts to create a long, unique token
  return `${timestamp}_${randomPart1}_${randomPart2}_${randomPart3}`;
};

/**
 * Create a temporary access token for medical history
 * @param petId - ID of the pet
 * @param userId - ID of the user creating the token
 * @param expirationHours - Hours until token expires (default: 2)
 * @returns Promise with token data
 */
export const createMedicalHistoryToken = async (
  petId: string,
  userId: string,
  expirationHours: number = 2
): Promise<{ success: boolean; token?: string; expiresAt?: Date; error?: string }> => {
  try {
    // Check session validity before creating token
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
      return { success: false, error: 'Sesión no válida. Por favor inicia sesión nuevamente.' };
    }

    // Verify user owns the pet
    const { data: petData, error: petError } = await supabaseClient
      .from('pets')
      .select('id, name, owner_id')
      .eq('id', petId)
      .eq('owner_id', userId)
      .single();

    if (petError || !petData) {
      return { success: false, error: 'Pet not found or access denied' };
    }

    // Generate secure token
    const token = generateSecureToken();
    
    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    // Create token record
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('medical_history_tokens')
      .insert({
        pet_id: petId,
        token: token,
        expires_at: expiresAt.toISOString(),
        created_by: userId,
        access_count: 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (tokenError) {
      console.error('Error creating medical history token:', tokenError);
      if (tokenError?.message?.includes('JWT') || tokenError?.message?.includes('expired')) {
        return { success: false, error: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.' };
      }
      return { success: false, error: 'Failed to create access token' };
    }

    console.log('Medical history token created:', {
      petId,
      token: token.substring(0, 8) + '...',
      expiresAt: expiresAt.toISOString()
    });

    return {
      success: true,
      token: token,
      expiresAt: expiresAt
    };
  } catch (error) {
    console.error('Error in createMedicalHistoryToken:', error);
    
    // Check if this is a session error
    if (error?.message?.includes('JWT') || error?.message?.includes('expired') || error?.message?.includes('session')) {
      return { success: false, error: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.' };
    }
    
    return { success: false, error: 'Internal error creating token' };
  }
};

/**
 * Verify and validate a medical history token
 * @param token - The token to verify
 * @returns Promise with validation result and pet data
 */
export const verifyMedicalHistoryToken = async (
  token: string
): Promise<{ 
  success: boolean; 
  petId?: string; 
  isExpired?: boolean; 
  error?: string;
  accessCount?: number;
}> => {
  try {
    console.log('Verifying medical history token:', token.substring(0, 8) + '...');
    
    // Find token in database
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('medical_history_tokens')
      .select('*')
      .eq('token', token)
      .single();

    console.log('Token lookup result:', { 
      found: !!tokenData, 
      error: tokenError?.message,
      petId: tokenData?.pet_id,
      expiresAt: tokenData?.expires_at
    });
    if (tokenError || !tokenData) {
      console.log('Token not found:', token.substring(0, 8) + '...');
      return { success: false, error: 'Invalid token' };
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    
    console.log('Token expiration check:', {
      now: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isExpired: now > expiresAt
    });
    
    if (now > expiresAt) {
      console.log('Token expired:', {
        token: token.substring(0, 8) + '...',
        expiresAt: expiresAt.toISOString(),
        now: now.toISOString()
      });
      return { 
        success: false, 
        isExpired: true, 
        error: 'Token has expired' 
      };
    }

    // Update access tracking
    try {
      console.log('Updating access tracking...');
      await supabaseClient
        .from('medical_history_tokens')
        .update({
          accessed_at: new Date().toISOString(),
          access_count: (tokenData.access_count || 0) + 1
        })
        .eq('id', tokenData.id);
      console.log('Access tracking updated');
    } catch (updateError) {
      console.warn('Could not update access tracking:', updateError);
      // Don't fail the verification if tracking update fails
    }

    console.log('Token verified successfully:', {
      petId: tokenData.pet_id,
      accessCount: (tokenData.access_count || 0) + 1,
      expiresAt: expiresAt.toISOString()
    });

    return {
      success: true,
      petId: tokenData.pet_id,
      isExpired: false,
      accessCount: (tokenData.access_count || 0) + 1
    };
  } catch (error) {
    console.error('Error verifying medical history token:', error);
    return { success: false, error: 'Error verifying token' };
  }
};

/**
 * Generate a secure URL for medical history access
 * @param petId - ID of the pet
 * @param userId - ID of the user creating the token
 * @returns Promise with secure URL
 */
export const generateSecureMedicalHistoryUrl = async (
  petId: string,
  userId: string
): Promise<{ success: boolean; url?: string; token?: string; expiresAt?: Date; error?: string }> => {
  try {
    // Check session validity before starting
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
      return { success: false, error: 'Sesión no válida. Por favor inicia sesión nuevamente.' };
    }

    const tokenResult = await createMedicalHistoryToken(petId, userId);
    
    if (!tokenResult.success || !tokenResult.token) {
      return { success: false, error: tokenResult.error };
    }

    const appDomain = process.env.EXPO_PUBLIC_APP_DOMAIN || 
                     process.env.EXPO_PUBLIC_APP_URL || 
                     'https://app-dogcatify.netlify.app';
    const secureUrl = `${appDomain}/medical-history/${petId}?token=${tokenResult.token}`;

    return {
      success: true,
      url: secureUrl,
      token: tokenResult.token,
      expiresAt: tokenResult.expiresAt
    };
  } catch (error) {
    
    // Check if this is a session error
    if (error?.message?.includes('JWT') || error?.message?.includes('expired') || error?.message?.includes('session')) {
      return { success: false, error: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.' };
    }
    
    console.error('Error generating secure medical history URL:', error);
    return { success: false, error: 'Failed to generate secure URL' };
  }
};

/**
 * Clean up expired tokens (should be called periodically)
 */
export const cleanupExpiredTokens = async (): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
  try {
    const { data, error } = await supabaseClient
      .from('medical_history_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('Error cleaning up expired tokens:', error);
      return { success: false, error: 'Failed to cleanup expired tokens' };
    }

    const deletedCount = data?.length || 0;
    console.log(`Cleaned up ${deletedCount} expired medical history tokens`);

    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error in cleanupExpiredTokens:', error);
    return { success: false, error: 'Internal error during cleanup' };
  }
};

/**
 * Get active tokens for a pet (for owner to manage)
 */
export const getActiveMedicalHistoryTokens = async (
  petId: string,
  userId: string
): Promise<{ success: boolean; tokens?: MedicalHistoryToken[]; error?: string }> => {
  try {
    const { data: tokens, error } = await supabaseClient
      .from('medical_history_tokens')
      .select('*')
      .eq('pet_id', petId)
      .eq('created_by', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active tokens:', error);
      return { success: false, error: 'Failed to fetch tokens' };
    }

    return { success: true, tokens: tokens || [] };
  } catch (error) {
    console.error('Error in getActiveMedicalHistoryTokens:', error);
    return { success: false, error: 'Internal error fetching tokens' };
  }
};

/**
 * Revoke a medical history token
 */
export const revokeMedicalHistoryToken = async (
  tokenId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verify user owns the token
    const { error } = await supabaseClient
      .from('medical_history_tokens')
      .delete()
      .eq('id', tokenId)
      .eq('created_by', userId);

    if (error) {
      console.error('Error revoking token:', error);
      return { success: false, error: 'Failed to revoke token' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in revokeMedicalHistoryToken:', error);
    return { success: false, error: 'Internal error revoking token' };
  }
};