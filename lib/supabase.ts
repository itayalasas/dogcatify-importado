import { Platform } from 'react-native';

// Simple storage interface for web compatibility
const storage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return await AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.removeItem(key);
    }
  }
};

// Get environment variables
const getSupabaseUrl = () => {
  return process.env.EXPO_PUBLIC_SUPABASE_URL || '';
};

const getSupabaseAnonKey = () => {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
};

// Simple Supabase client implementation
const createSupabaseClient = () => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
  }
  
  return {
    auth: {
      signUp: async ({ email, password, options }: any) => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({ 
              email, 
              password, 
              data: options?.data || {},
              options: {
                emailRedirectTo: options?.emailRedirectTo
              }
            }),
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            return { data: { user: null, session: null }, error: result };
          }
          
          return { data: result, error: null };
        } catch (error) {
          return { data: { user: null, session: null }, error };
        }
      },
      
      signInWithPassword: async ({ email, password }: any) => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({ email, password }),
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            return { data: { user: null, session: null }, error: result };
          }
          
          // Store token for future requests
          if (result.access_token) {
            await storage.setItem('supabase_token', result.access_token);
            await storage.setItem('supabase_user', JSON.stringify(result.user));
          }
          
          return { 
            data: { 
              user: result.user, 
              session: { 
                access_token: result.access_token,
                user: result.user 
              } 
            }, 
            error: null 
          };
        } catch (error) {
          return { data: { user: null, session: null }, error };
        }
      },
      
      signOut: async () => {
        try {
          const token = await storage.getItem('supabase_token');
          
          if (token) {
            await fetch(`${supabaseUrl}/auth/v1/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
              },
            });
          }
          
          await storage.removeItem('supabase_token');
          await storage.removeItem('supabase_user');
          
          return { error: null };
        } catch (error) {
          return { error };
        }
      },
      
      getUser: async () => {
        try {
          const token = await storage.getItem('supabase_token');
          if (!token) {
            return { data: { user: null }, error: null };
          }
          
          const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!response.ok) {
            return { data: { user: null }, error: null };
          }
          
          const user = await response.json();
          return { data: { user }, error: null };
        } catch (error) {
          return { data: { user: null }, error };
        }
      },
      
      getSession: async () => {
        try {
          const token = await storage.getItem('supabase_token');
          const userStr = await storage.getItem('supabase_user');
          
          if (!token || !userStr) {
            return { data: { session: null }, error: null };
          }
          
          const user = JSON.parse(userStr);
          return { 
            data: { 
              session: { 
                access_token: token, 
                user 
              } 
            }, 
            error: null 
          };
        } catch (error) {
          return { data: { session: null }, error };
        }
      },
      
      onAuthStateChange: (callback: any) => {
        // Simple implementation - in a real app you'd want proper event handling
        return { 
          data: { 
            subscription: { 
              unsubscribe: () => {} 
            } 
          } 
        };
      },
      
      resetPasswordForEmail: async (email: string, options?: any) => {
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({ 
              email, 
              options: {
                redirectTo: options?.redirectTo
              }
            }),
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            return { error: result };
          }
          
          return { error: null };
        } catch (error) {
          return { error };
        }
      },
      
      updateUser: async (updates: any) => {
        try {
          const token = await storage.getItem('supabase_token');
          const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          });
          
          const result = await response.json();
          
          if (!response.ok) {
            return { data: { user: null }, error: result };
          }
          
          return { data: { user: result }, error: null };
        } catch (error) {
          return { data: { user: null }, error };
        }
      },
    },
    
    from: (table: string) => ({
      select: (columns = '*', options?: any) => {
        const buildQuery = async (filters: any = {}, orderBy?: string, rangeStart?: number, rangeEnd?: number) => {
          try {
            const token = await storage.getItem('supabase_token');
            let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;
            
            // Add filters
            Object.entries(filters).forEach(([key, value]) => {
              url += `&${key}=${value}`;
            });
            
            // Add order
            if (orderBy) {
              url += `&order=${orderBy}`;
            }
            
            // Add range
            if (rangeStart !== undefined && rangeEnd !== undefined) {
              url += `&limit=${rangeEnd - rangeStart + 1}&offset=${rangeStart}`;
            }
            
            // Add count if requested
            const headers: any = {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
            };
            
            if (options?.count) {
              headers['Prefer'] = 'count=exact';
            }
            
            const response = await fetch(url, { headers });
            
            if (!response.ok) {
              const error = await response.json();
              return { data: null, error, count: null };
            }
            
            const data = await response.json();
            const count = response.headers.get('Content-Range')?.split('/')[1];
            
            return { data, error: null, count: count ? parseInt(count) : null };
          } catch (error) {
            return { data: null, error, count: null };
          }
        };
        
        return {
          eq: (column: string, value: any) => ({
            single: async () => {
              const result = await buildQuery({ [`${column}`]: `eq.${value}` });
              return { 
                data: result.data?.[0] || null, 
                error: result.error 
              };
            },
            order: (orderColumn: string, orderOptions?: any) => ({
              range: (start: number, end: number) => ({
                then: async (resolve: any) => {
                  const orderParam = orderOptions?.ascending ? `${orderColumn}.asc` : `${orderColumn}.desc`;
                  const result = await buildQuery({ 
                    [`${column}`]: `eq.${value}` 
                  }, orderParam, start, end);
                  resolve(result);
                }
              }),
              limit: (limitCount: number) => ({
                then: async (resolve: any) => {
                  const orderParam = orderOptions?.ascending ? `${orderColumn}.asc` : `${orderColumn}.desc`;
                  const result = await buildQuery({ 
                    [`${column}`]: `eq.${value}`,
                    order: orderParam,
                    limit: limitCount
                  });
                  resolve(result);
                }
              })
            }),
            then: async (resolve: any) => {
              const result = await buildQuery({ [`${column}`]: `eq.${value}` });
              resolve(result);
            }
          }),
          order: (orderColumn: string, orderOptions?: any) => ({
            range: (start: number, end: number) => ({
              then: async (resolve: any) => {
                const orderParam = orderOptions?.ascending ? `${orderColumn}.asc` : `${orderColumn}.desc`;
                const result = await buildQuery({}, orderParam, start, end);
                resolve(result);
              }
            }),
            then: async (resolve: any) => {
              const orderParam = orderOptions?.ascending ? `${orderColumn}.asc` : `${orderColumn}.desc`;
              const result = await buildQuery({ order: orderParam });
              resolve(result);
            }
          }),
          then: async (resolve: any) => {
            const result = await buildQuery();
            resolve(result);
          }
        };
      },
      
      insert: async (data: any) => {
        try {
          const token = await storage.getItem('supabase_token');
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Prefer': 'return=representation',
            },
            body: JSON.stringify(Array.isArray(data) ? data : [data]),
          });
          
          if (!response.ok) {
            const error = await response.json();
            return { data: null, error };
          }
          
          const result = await response.json();
          return { data: result, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      
      update: (data: any) => ({
        eq: async (column: string, value: any) => {
          try {
            const token = await storage.getItem('supabase_token');
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
                'Prefer': 'return=representation',
              },
              body: JSON.stringify(data),
            });
            
            if (!response.ok) {
              const error = await response.json();
              return { data: null, error };
            }
            
            const result = await response.json();
            return { data: result, error: null };
          } catch (error) {
            return { data: null, error };
          }
        }
      }),
      
      delete: () => ({
        eq: async (column: string, value: any) => {
          try {
            const token = await storage.getItem('supabase_token');
            const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'DELETE',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!response.ok) {
              const error = await response.json();
              return { error };
            }
            
            return { error: null };
          } catch (error) {
            return { error };
          }
        }
      })
    }),
    
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: any, options?: any) => {
          try {
            const token = await storage.getItem('supabase_token');
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
              },
              body: formData,
            });
            
            if (!response.ok) {
              const error = await response.json();
              return { data: null, error };
            }
            
            const result = await response.json();
            return { data: result, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}` }
        }),
        
        remove: async (paths: string[]) => {
          try {
            const token = await storage.getItem('supabase_token');
            const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ prefixes: paths }),
            });
            
            return { error: null };
          } catch (error) {
            return { error };
          }
        },
        
        listBuckets: async () => {
          try {
            const token = await storage.getItem('supabase_token');
            const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!response.ok) {
              return { data: null, error: await response.json() };
            }
            
            const buckets = await response.json();
            return { data: buckets, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
        
        createBucket: async (id: string, options?: any) => {
          try {
            const token = await storage.getItem('supabase_token');
            const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ id, ...options }),
            });
            
            if (!response.ok) {
              const error = await response.json();
              return { error };
            }
            
            return { error: null };
          } catch (error) {
            return { error };
          }
        }
      })
    },
    
    channel: (name: string) => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} })
    }),
    
    removeChannel: () => {}
  };
};

// Initialize the client
let supabaseClient;

try {
  supabaseClient = createSupabaseClient();
} catch (error) {
  console.error('Error initializing Supabase client:', error);
  // Create a fallback client to prevent crashes
  supabaseClient = {
    auth: {
      signUp: async () => ({ data: { user: null, session: null }, error: new Error('Supabase not configured') }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: new Error('Supabase not configured') }),
      getUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
      getSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      resetPasswordForEmail: async () => ({ error: new Error('Supabase not configured') }),
      updateUser: async () => ({ data: { user: null }, error: new Error('Supabase not configured') }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error('Supabase not configured') }),
          order: () => ({
            range: () => ({
              then: async (resolve) => resolve({ data: [], error: new Error('Supabase not configured') })
            }),
            then: async (resolve) => resolve({ data: [], error: new Error('Supabase not configured') })
          }),
          then: async (resolve) => resolve({ data: [], error: new Error('Supabase not configured') })
        }),
        order: () => ({
          range: () => ({
            then: async (resolve) => resolve({ data: [], error: new Error('Supabase not configured') })
          }),
          then: async (resolve) => resolve({ data: [], error: new Error('Supabase not configured') })
        }),
        then: async (resolve) => resolve({ data: [], error: new Error('Supabase not configured') })
      }),
      insert: async () => ({ data: null, error: new Error('Supabase not configured') }),
      update: () => ({
        eq: async () => ({ data: null, error: new Error('Supabase not configured') })
      }),
      delete: () => ({
        eq: async () => ({ error: new Error('Supabase not configured') })
      })
    }),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: new Error('Supabase not configured') }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => ({ error: new Error('Supabase not configured') }),
        listBuckets: async () => ({ data: null, error: new Error('Supabase not configured') }),
        createBucket: async () => ({ error: new Error('Supabase not configured') })
      })
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} })
    }),
    removeChannel: () => {}
  };
}

// Export the client
export { supabaseClient };

// Authentication functions
export const signUp = async (email: string, password: string, userData: any) => {
  return await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://dogcatify.com/auth/login',
      data: {
        display_name: userData.displayName,
        photo_url: userData.photoURL,
      },
    },
  });
};

export const signIn = async (email: string, password: string) => {
  return await supabaseClient.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
  return await supabaseClient.auth.signOut();
};

export const getCurrentUser = async () => {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
};

export const getCurrentSession = async () => {
  const { data } = await supabaseClient.auth.getSession();
  return data?.session || null;
};

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

export const updateUserProfile = async (userId: string, updates: any) => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  
  if (error) throw error;
  return data;
};

// Storage functions
export const uploadFile = async (bucket: string, path: string, file: any) => {
  return await supabaseClient.storage.from(bucket).upload(path, file);
};

export const getFileUrl = (bucket: string, path: string): string => {
  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteFile = async (bucket: string, path: string) => {
  return await supabaseClient.storage.from(bucket).remove([path]);
};

// Database functions for pets
export const getPets = async (userId: string) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const getPet = async (petId: string) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .select('*')
    .eq('id', petId)
    .single();
  
  if (error) throw error;
  return data;
};

export const createPet = async (petData: any) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .insert(petData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updatePet = async (petId: string, updates: any) => {
  const { data, error } = await supabaseClient
    .from('pets')
    .update(updates)
    .eq('id', petId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deletePet = async (petId: string) => {
  const { error } = await supabaseClient
    .from('pets')
    .delete()
    .eq('id', petId);
  
  if (error) throw error;
};

// Database functions for posts
export const getPosts = async (limit = 10, offset = 0) => {
  const { data, error } = await supabaseClient
    .from('posts')
    .select('*,profiles:user_id(display_name, photo_url),pets:pet_id(name, species)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) throw error;
  return data;
};

export const getPostComments = async (postId: string) => {
  const { data, error } = await supabaseClient
    .from('comments')
    .select(`
      *,
      profiles:user_id(display_name, photo_url)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
};

export const createPost = async (postData: any) => {
  const { data, error } = await supabaseClient
    .from('posts')
    .insert(postData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const likePost = async (postId: string, userId: string) => {
  // First get the current post to check likes
  const { data: post, error: fetchError } = await supabaseClient
    .from('posts')
    .select('likes')
    .eq('id', postId)
    .single();
  
  if (fetchError) throw fetchError;
  
  const likes = post.likes || [];
  const isLiked = likes.includes(userId);
  
  const newLikes = isLiked
    ? likes.filter((id: string) => id !== userId)
    : [...likes, userId];
  
  const { data, error } = await supabaseClient
    .from('posts')
    .update({ likes: newLikes })
    .eq('id', postId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Database functions for partners
export const getPartners = async () => {
  const { data, error } = await supabaseClient
    .from('partners')
    .select('*')
    .eq('is_verified', true)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const getPartner = async (partnerId: string) => {
  const { data, error } = await supabaseClient
    .from('partners')
    .select('*')
    .eq('id', partnerId)
    .single();
  
  if (error) throw error;
  return data;
};

export const getPartnerServices = async (partnerId: string) => {
  const { data, error } = await supabaseClient
    .from('partner_services')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const getPartnerProducts = async (partnerId: string) => {
  const { data, error } = await supabaseClient
    .from('partner_products')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Database functions for bookings
export const createBooking = async (bookingData: any) => {
  const { data, error } = await supabaseClient
    .from('bookings')
    .insert(bookingData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getBookings = async (userId: string) => {
  const { data, error } = await supabaseClient
    .from('bookings')
    .select('*')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Helper function for time ago
export const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Ahora';
  if (diffInHours < 24) return `${diffInHours}h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d`;
  
  return date.toLocaleDateString();
};