import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { envConfig } from '@/utils/envConfig';

// Global state que sobrevive al Hot Reload de Metro
// @ts-ignore
if (!global.__supabaseClient) {
  // @ts-ignore
  global.__supabaseClient = null;
}

// Supabase configuration - Ahora se carga dinÃ¡micamente
let supabaseUrl: string | undefined;
let supabaseAnonKey: string | undefined;

// Usa el global en lugar de una variable local
function getSupabaseClientInstance(): SupabaseClient | null {
  // @ts-ignore
  return global.__supabaseClient;
}

function setSupabaseClientInstance(client: SupabaseClient | null): void {
  // @ts-ignore
  global.__supabaseClient = client;
}

/**
 * Inicializa el cliente de Supabase con la configuraciÃ³n del API Gateway
 */
export const initializeSupabase = async (): Promise<void> => {
  try {
    // Asegurarse de que envConfig estÃ© inicializado
    if (!envConfig.isInitialized()) {
      await envConfig.initialize();
    }

    // Hidratar variables exportadas siempre (incluso si se reutiliza cliente por Hot Reload)
    supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
    supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

    // Si ya existe un cliente, reutilizarlo
    const existingClient = getSupabaseClientInstance();
    if (existingClient) {
      return;
    }



    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables from API Gateway');
    }


    // Crear cliente de Supabase
    const newClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: {
          'X-Client-Info': 'dogcatify-mobile',
        },
        fetch: createAuthAwareFetch(),
      },
    });

    setSupabaseClientInstance(newClient);
  } catch (error) {
    throw error;
  }
};

/**
 * Obtiene el cliente de Supabase
 * IMPORTANTE: Debe llamarse despuÃ©s de initializeSupabase()
 */
export const getSupabaseClient = (): SupabaseClient => {
  const client = getSupabaseClientInstance();
  if (!client) {
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }
  return client;
};

// Export para compatibilidad con cÃ³digo existente
export const supabaseClient = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseClientInstance();
    if (!client) {
      throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
    }
    return (client as any)[prop];
  }
});

/**
 * Configura los listeners de auth despuÃ©s de inicializar Supabase
 */
export const setupAuthListeners = () => {
  const client = getSupabaseClientInstance();
  if (!client) {
    return;
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
    } else if (event === 'SIGNED_OUT') {
    }
  });
};

// Token expiration handling
let tokenExpirationCallback: (() => void) | null = null;

export const setTokenExpirationCallback = (callback: () => void) => {
  tokenExpirationCallback = callback;
};

const isSessionErrorResponse = (status: number, responseText: string): boolean => {
  const text = (responseText || '').toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    text.includes('jwt') ||
    text.includes('expired') ||
    text.includes('session_not_found') ||
    text.includes('refresh_token_not_found') ||
    text.includes('invalid refresh token') ||
    text.includes('pgrst301')
  );
};

const createAuthAwareFetch = () => {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetch(input, init);

    if (!response.ok) {
      try {
        const responseClone = response.clone();
        const responseText = await responseClone.text();

        if (isSessionErrorResponse(response.status, responseText) && tokenExpirationCallback) {
          tokenExpirationCallback();
        }
      } catch (inspectError) {
      }
    }

    return response;
  };
};
export const handleSupabaseError = (error: any) => {
  if (error && typeof error === 'object') {
    const errorMessage = (error.message || '').toLowerCase();
    const errorCode = (error.code || '').toLowerCase();

    const isJWTError =
      errorMessage.includes('jwt') ||
      errorMessage.includes('expired') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('session_not_found') ||
      errorMessage.includes('refresh_token_not_found') ||
      errorCode === 'pgrst301';

    if (isJWTError) {

      if (tokenExpirationCallback) {
        tokenExpirationCallback();
      }
    }
  }
};

// User profile functions
type ProfileRoleFlags = {
  isOwner: boolean;
  isPartner: boolean;
  isAdmin: boolean;
};

const parseMetadataBoolean = (value: any): boolean | undefined => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const resolveProfileRoleFlags = (metadata: any, existing?: Partial<ProfileRoleFlags> | null): ProfileRoleFlags => {
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

export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    // If profile doesn't exist, create it automatically
    if (!data) {

      // Get user data from auth
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

      if (authError || !user) {
        throw new Error('Could not fetch user data from auth');
      }

      // Create the missing profile
      const roleFlags = resolveProfileRoleFlags(user?.user_metadata, null);
      const newProfile = {
        id: userId,
        email: user.email!,
        display_name: (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Usuario',
        is_owner: roleFlags.isOwner,
        is_partner: roleFlags.isPartner,
        is_admin: roleFlags.isAdmin,
        email_confirmed: false,
        email_confirmed_at: null,
        onboarding_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers: [],
        following: []
      };


      const { data: createdProfile, error: createError } = await supabaseClient
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return createdProfile;
    }

    // If the profile already exists, make sure its role matches the auth metadata
    try {
      const { data: authData } = await supabaseClient.auth.getUser();
      const authUser = authData?.user;

      if (authUser) {
        const currentRoleFlags = {
          isOwner: data.is_owner ?? true,
          isPartner: data.is_partner ?? false,
          isAdmin: data.is_admin ?? false,
        };
        const roleFlags = resolveProfileRoleFlags(authUser.user_metadata, currentRoleFlags);

        if (
          currentRoleFlags.isOwner !== roleFlags.isOwner ||
          currentRoleFlags.isPartner !== roleFlags.isPartner ||
          currentRoleFlags.isAdmin !== roleFlags.isAdmin
        ) {
          const { data: updatedProfile, error: roleUpdateError } = await supabaseClient
            .from('profiles')
            .update({
              is_owner: roleFlags.isOwner,
              is_partner: roleFlags.isPartner,
              is_admin: roleFlags.isAdmin,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
            .select('*')
            .single();

          if (!roleUpdateError && updatedProfile) {
            return updatedProfile;
          }

          if (roleUpdateError) {
          }

          return {
            ...data,
            is_owner: roleFlags.isOwner,
            is_partner: roleFlags.isPartner,
            is_admin: roleFlags.isAdmin,
          };
        }
      }
    } catch (syncError) {
    }

    return data;
  } catch (error) {
    throw error;
  }
};

export const updateUserProfile = async (userId: string, updates: any) => {
  try {
    const { data: existingProfile, error: existingProfileError } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    if (existingProfileError) {
    }

    let resolvedEmail = String(updates?.email || '').trim();

    if (!resolvedEmail) {
      resolvedEmail = String(existingProfile?.email || '').trim();
    }

    if (!resolvedEmail) {
      try {
        const { data: authData } = await supabaseClient.auth.getUser();
        resolvedEmail = String(authData?.user?.email || '').trim();
      } catch (authError) {
      }
    }

    if (!resolvedEmail) {
      throw new Error(`Unable to resolve email for profile update: ${userId}`);
    }

    const { error } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        email: resolvedEmail,
        ...updates,
        updated_at: new Date().toISOString(),
      });
    
    if (error) throw error;
  } catch (error) {
    throw error;
  }
};

// Pet functions
export const getPet = async (petId: string) => {
  try {
    const { data, error } = await supabaseClient
      .from('pets')
      .select('*')
      .eq('id', petId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// Auth functions
export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

export const signUp = async (email: string, password: string, displayName: string) => {
  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw error;
  }
};

// Pet functions
export const getPets = async (userId: string) => {
  try {
    const { data, error } = await supabaseClient
      .from('pets')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

export const deletePet = async (petId: string) => {
  try {
    const { error } = await supabaseClient
      .from('pets')
      .delete()
      .eq('id', petId);
    
    if (error) throw error;
  } catch (error) {
    throw error;
  }
};


