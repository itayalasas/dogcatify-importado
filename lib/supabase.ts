import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { envConfig } from '@/utils/envConfig';

// Global state que sobrevive al Hot Reload de Metro
// @ts-ignore
if (!global.__supabaseClient) {
  // @ts-ignore
  global.__supabaseClient = null;
}

// Supabase configuration - Ahora se carga dinámicamente
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
 * Inicializa el cliente de Supabase con la configuración del API Gateway
 */
export const initializeSupabase = async (): Promise<void> => {
  try {
    // Si ya existe un cliente, reutilizarlo
    const existingClient = getSupabaseClientInstance();
    if (existingClient) {
      console.log('[Supabase] ♻️ Reusing existing Supabase client (Hot Reload)');
      return;
    }

    console.log('[Supabase] 🚀 Initializing Supabase client...');

    // Asegurarse de que envConfig esté inicializado
    if (!envConfig.isInitialized()) {
      console.log('[Supabase] ⏳ Waiting for envConfig initialization...');
      await envConfig.initialize();
    }

    // Obtener configuración
    supabaseUrl = envConfig.get('EXPO_PUBLIC_SUPABASE_URL');
    supabaseAnonKey = envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY');

    console.log('[Supabase] 🔗 Raw Supabase URL from config:', supabaseUrl);
    console.log('[Supabase] 🔑 Raw Anon Key from config:', supabaseAnonKey);
    console.log('[Supabase] 📊 URL type:', typeof supabaseUrl, 'length:', supabaseUrl?.length);
    console.log('[Supabase] 📊 Key type:', typeof supabaseAnonKey, 'length:', supabaseAnonKey?.length);

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[Supabase] ❌ Missing variables:');
      console.error('  - URL:', supabaseUrl ? 'Present' : 'MISSING');
      console.error('  - Key:', supabaseAnonKey ? 'Present' : 'MISSING');
      throw new Error('Missing Supabase environment variables from API Gateway');
    }

    console.log('[Supabase] 🔗 Supabase URL:', supabaseUrl);
    console.log('[Supabase] 🔑 Anon Key (first 50 chars):', supabaseAnonKey.substring(0, 50) + '...');

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
      },
    });

    setSupabaseClientInstance(newClient);
    console.log('[Supabase] ✅ Supabase client initialized successfully');
  } catch (error) {
    console.error('[Supabase] ❌ Failed to initialize Supabase client:', error);
    throw error;
  }
};

/**
 * Obtiene el cliente de Supabase
 * IMPORTANTE: Debe llamarse después de initializeSupabase()
 */
export const getSupabaseClient = (): SupabaseClient => {
  const client = getSupabaseClientInstance();
  if (!client) {
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }
  return client;
};

// Export para compatibilidad con código existente
export const supabaseClient = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseClientInstance();
    if (!client) {
      console.warn('[Supabase] ⚠️ Accessing supabaseClient before initialization');
      throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
    }
    return (client as any)[prop];
  }
});

/**
 * Configura los listeners de auth después de inicializar Supabase
 */
export const setupAuthListeners = () => {
  const client = getSupabaseClientInstance();
  if (!client) {
    console.warn('[Supabase] ⚠️ Cannot setup auth listeners before initialization');
    return;
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('Token refreshed automatically by Supabase');
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
    }
  });
};

// Token expiration handling
let tokenExpirationCallback: (() => void) | null = null;

export const setTokenExpirationCallback = (callback: () => void) => {
  tokenExpirationCallback = callback;
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
      console.log('JWT/Session error detected in API call:', errorMessage);

      if (tokenExpirationCallback) {
        console.log('Triggering token expiration callback');
        tokenExpirationCallback();
      }
    }
  }
};

// User profile functions
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
      console.log('Profile not found for user:', userId);
      console.log('Attempting to fetch user data from auth.users and create profile...');

      // Get user data from auth
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

      if (authError || !user) {
        throw new Error('Could not fetch user data from auth');
      }

      // Create the missing profile
      const newProfile = {
        id: userId,
        email: user.email!,
        display_name: (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'Usuario',
        is_owner: true,
        is_partner: false,
        email_confirmed: user.email_confirmed_at !== null,
        email_confirmed_at: user.email_confirmed_at,
        onboarding_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers: [],
        following: []
      };

      console.log('Creating missing profile:', newProfile);

      const { data: createdProfile, error: createError } = await supabaseClient
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        throw createError;
      }

      console.log('Profile created successfully');
      return createdProfile;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

export const updateUserProfile = async (userId: string, updates: any) => {
  try {
    const { error } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating user profile:', error);
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
    console.error('Error fetching pet:', error);
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
    console.error('Error signing in:', error);
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
    console.error('Error signing up:', error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out:', error);
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
    console.error('Error fetching pets:', error);
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
    console.error('Error deleting pet:', error);
    throw error;
  }
};