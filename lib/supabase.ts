import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Supabase configuration
export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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

// Add global error handler for API calls
const originalFrom = supabaseClient.from;
supabaseClient.from = function(table: string) {
  const query = originalFrom.call(this, table);
  
  // Override the query methods to add error handling
  const originalSelect = query.select;
  const originalInsert = query.insert;
  const originalUpdate = query.update;
  const originalDelete = query.delete;
  
  query.select = function(...args: any[]) {
    const result = originalSelect.apply(this, args);
    return addErrorHandling(result);
  };
  
  query.insert = function(...args: any[]) {
    const result = originalInsert.apply(this, args);
    return addErrorHandling(result);
  };
  
  query.update = function(...args: any[]) {
    const result = originalUpdate.apply(this, args);
    return addErrorHandling(result);
  };
  
  query.delete = function(...args: any[]) {
    const result = originalDelete.apply(this, args);
    return addErrorHandling(result);
  };
  
  return query;
};

// Add error handling to detect JWT expiration
const addErrorHandling = (queryBuilder: any) => {
  const originalThen = queryBuilder.then;
  
  queryBuilder.then = function(onFulfilled?: any, onRejected?: any) {
    return originalThen.call(this, 
      (result: any) => {
        // Check for JWT errors in successful responses
        if (result.error) {
          handleSupabaseError(result.error);
        }
        return onFulfilled ? onFulfilled(result) : result;
      },
      (error: any) => {
        handleSupabaseError(error);
        return onRejected ? onRejected(error) : Promise.reject(error);
      }
    );
  };
  
  return queryBuilder;
};

// Handle Supabase errors globally
const handleSupabaseError = (error: any) => {
  if (error && typeof error === 'object') {
    const errorMessage = error.message || '';
    
    // Check for JWT expiration errors
    if (errorMessage.includes('JWT') && 
        (errorMessage.includes('expired') || 
         errorMessage.includes('invalid') ||
         errorMessage.includes('malformed'))) {
      
      console.log('JWT error detected in API call:', errorMessage);
      
      // For React Native, we'll handle this through the AuthContext directly
      // The AuthContext already has periodic token checking
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
      .single();
    
    if (error) throw error;
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