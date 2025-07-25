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

// Query builder class to handle method chaining
class QueryBuilder {
  private table: string;
  private selectColumns: string = '*';
  private filters: Array<{column: string, operator: string, value: any}> = [];
  private orderColumn?: string;
  private orderAscending?: boolean;
  private limitCount?: number;
  private rangeStart?: number;
  private rangeEnd?: number;
  private countOption?: string;
  private supabaseUrl: string;
  private supabaseAnonKey: string;

  constructor(table: string, supabaseUrl: string, supabaseAnonKey: string) {
    this.table = table;
    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;
  }

  select(columns: string = '*', options?: any) {
    this.selectColumns = columns;
    if (options?.count) {
      this.countOption = options.count;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: 'eq', value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, operator: 'in', value: `(${values.map(v => `"${v}"`).join(',')})` });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, operator: 'neq', value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, operator: 'gte', value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, operator: 'lte', value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ column, operator: 'lt', value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ column, operator: 'gt', value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(start: number, end: number) {
    this.rangeStart = start;
    this.rangeEnd = end;
    return this;
  }

  private buildUrl(): string {
    let url = `${this.supabaseUrl}/rest/v1/${this.table}?select=${encodeURIComponent(this.selectColumns)}`;
    
    // Add filters
    this.filters.forEach(filter => {
      url += `&${encodeURIComponent(filter.column)}=${filter.operator}.${encodeURIComponent(filter.value)}`;
    });
    
    // Add order
    if (this.orderColumn) {
      const orderDirection = this.orderAscending ? 'asc' : 'desc';
      url += `&order=${encodeURIComponent(this.orderColumn)}.${orderDirection}`;
    }
    
    // Add limit
    if (this.limitCount) {
      url += `&limit=${this.limitCount}`;
    }
    
    // Add range
    if (this.rangeStart !== undefined && this.rangeEnd !== undefined) {
      url += `&offset=${this.rangeStart}&limit=${this.rangeEnd - this.rangeStart + 1}`;
    }
    
    return url;
  }

  private async getHeaders() {
    const token = await storage.getItem('supabase_token');
    const headers: any = {
      'apikey': this.supabaseAnonKey,
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (this.countOption) {
      headers['Prefer'] = `count=${this.countOption}`;
    }
    
    return headers;
  }

  async execute() {
    try {
      const url = this.buildUrl();
      const headers = await this.getHeaders();
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const error = await response.json();
        return { data: null, error, count: null };
      }
      
      const data = await response.json();
      
      // Get count from Content-Range header if requested
      let count = null;
      if (this.countOption) {
        const contentRange = response.headers.get('Content-Range');
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)$/);
          count = match ? parseInt(match[1]) : null;
        }
      }
      
      return { data, error: null, count };
    } catch (error) {
      return { data: null, error, count: null };
    }
  }

  async single() {
    const result = await this.execute();
    return {
      data: result.data?.[0] || null,
      error: result.error
    };
  }

  // Make QueryBuilder thenable so it works with async/await
  then(resolve: any, reject?: any) {
    return this.execute().then(resolve, reject);
  }
}

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
      
      refreshSession: async () => {
        try {
          const token = await storage.getItem('supabase_token');
          if (!token) {
            return { data: { session: null }, error: new Error('No token found') };
          }
          
          const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ refresh_token: token }),
          });
          
          if (!response.ok) {
            const error = await response.json();
            return { data: { session: null }, error };
          }
          
          const result = await response.json();
          
          // Store new token
          if (result.access_token) {
            await storage.setItem('supabase_token', result.access_token);
            await storage.setItem('supabase_user', JSON.stringify(result.user));
          }
          
          return { 
            data: { 
              session: { 
                access_token: result.access_token,
                user: result.user 
              } 
            }, 
            error: null 
          };
        } catch (error) {
          return { data: { session: null }, error };
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
            // If unauthorized, try to refresh session
            if (response.status === 401) {
              console.log('AuthContext - Token expired, attempting refresh...');
              const refreshResult = await supabaseClient.auth.refreshSession();
              if (refreshResult.data?.session) {
                // Retry with new token
                const newToken = refreshResult.data.session.access_token;
                const retryResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
                  headers: {
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${newToken}`,
                  },
                });
                
                if (retryResponse.ok) {
                  const user = await retryResponse.json();
                  return { data: { user }, error: null };
                }
              }
            }
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
    
    from: (table: string) => {
      return new QueryBuilder(table, supabaseUrl, supabaseAnonKey);
    },
    
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: any, options?: any) => {
          try {
            const token = await storage.getItem('supabase_token');
            
            // Handle different file types
            let fileData;
            if (file instanceof Blob) {
              fileData = file;
            } else if (typeof file === 'string') {
              // If it's a URI, fetch it first
              const response = await fetch(file);
              fileData = await response.blob();
            } else if (file.uri) {
              // If it's an object with uri property
              const response = await fetch(file.uri);
              fileData = await response.blob();
            } else {
              fileData = file;
            }
            
            const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`,
              },
              body: fileData,
            });
            
            if (!response.ok) {
              const error = await response.json();
              console.error('Storage upload error:', error);
              return { data: null, error };
            }
            
            const result = await response.json();
            return { data: result, error: null };
          } catch (error) {
            console.error('Storage upload exception:', error);
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

// Add insert and update methods to QueryBuilder
QueryBuilder.prototype.insert = async function(data: any) {
  const token = await storage.getItem('supabase_token');
  
  const insertBuilder = {
    select: () => ({
      single: async () => {
        try {
          const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.table}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': this.supabaseAnonKey,
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
          return { data: result[0] || null, error: null };
        } catch (error) {
          return { data: null, error };
        }
      }
    }),
    
    // Direct execution without select
    execute: async () => {
      try {
        const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.table}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(Array.isArray(data) ? data : [data]),
        });

        if (!response.ok) {
          const error = await response.json();
          return { data: null, error };
        }

        return { data: null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    }
  };
  
  // Make it thenable for direct await
  insertBuilder.then = function(resolve: any, reject?: any) {
    return insertBuilder.execute().then(resolve, reject);
  };
  
  return insertBuilder;
};

QueryBuilder.prototype.update = function(data: any) {
  const updateBuilder = {
    eq: async (column: string, value: any) => {
      try {
        const token = await storage.getItem('supabase_token');
        const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.table}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey,
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
  };
  
  return updateBuilder;
};

QueryBuilder.prototype.upsert = function(data: any) {
  const upsertBuilder = {
    eq: async (column: string, value: any) => {
      try {
        const token = await storage.getItem('supabase_token');
        const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.table}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'resolution=merge-duplicates,return=representation',
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
    
    // Direct execution without eq
    execute: async () => {
      try {
        const token = await storage.getItem('supabase_token');
        const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.table}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'resolution=merge-duplicates,return=representation',
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
    }
  };
  
  // Make it thenable for direct await
  upsertBuilder.then = function(resolve: any, reject?: any) {
    return upsertBuilder.execute().then(resolve, reject);
  };
  
  return upsertBuilder;
};

QueryBuilder.prototype.delete = function() {
  const deleteBuilder = {
    eq: async (column: string, value: any) => {
      try {
        const token = await storage.getItem('supabase_token');
        const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.table}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`, {
          method: 'DELETE',
          headers: {
            'apikey': this.supabaseAnonKey,
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
    },
    
    in: async (column: string, values: any[]) => {
      try {
        const token = await storage.getItem('supabase_token');
        const valuesString = `(${values.map(v => `"${v}"`).join(',')})`;
        const response = await fetch(`${this.supabaseUrl}/rest/v1/${this.table}?${encodeURIComponent(column)}=in.${encodeURIComponent(valuesString)}`, {
          method: 'DELETE',
          headers: {
            'apikey': this.supabaseAnonKey,
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
  };
  
  return deleteBuilder;
};

interface SupabaseAuth {
  signUp: Function;
  signInWithPassword: Function;
  signOut: Function;
  getUser: Function;
  getSession: Function;
  onAuthStateChange: Function;
  resetPasswordForEmail: Function;
  updateUser: Function;
}

interface SupabaseStorage {
  from: Function;
}

interface SupabaseClient {
  auth: SupabaseAuth;
  from: Function;
  storage: SupabaseStorage;
  channel: Function;
  removeChannel: Function;
}

let supabaseClient: SupabaseClient;

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
    from: () => new QueryBuilder('', '', ''),
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
    .eq('id', petId);
  
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
    .eq('id', postId);
  
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