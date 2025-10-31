import { supabaseClient } from '../lib/supabase';
import { router } from 'expo-router';

export class TokenExpiredError extends Error {
  constructor(message = 'Token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

const isJWTError = (error: any): boolean => {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';

  return (
    errorMessage.includes('jwt') ||
    errorMessage.includes('expired') ||
    errorMessage.includes('invalid') ||
    errorMessage.includes('session_not_found') ||
    errorMessage.includes('refresh_token_not_found') ||
    errorCode === 'pgrst301'
  );
};

export const withTokenValidation = async <T>(
  operation: () => Promise<T>,
  context = 'operation'
): Promise<T> => {
  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError) {
      console.error(`Session error in ${context}:`, sessionError);

      if (isJWTError(sessionError)) {
        console.log('JWT error detected before operation, redirecting to login');
        router.replace('/auth/login');
        throw new TokenExpiredError('Session invalid');
      }

      throw sessionError;
    }

    if (!session) {
      console.log('No session found, redirecting to login');
      router.replace('/auth/login');
      throw new TokenExpiredError('No session found');
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenExp = session.expires_at || 0;

    if (now >= tokenExp) {
      console.log('Token expired, attempting refresh before operation...');

      try {
        const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          console.error('Failed to refresh session:', refreshError);
          console.log('Redirecting to login due to refresh failure');
          router.replace('/auth/login');
          throw new TokenExpiredError('Failed to refresh session');
        }

        console.log('Session refreshed successfully, proceeding with operation');
      } catch (refreshError) {
        console.error('Exception during refresh:', refreshError);
        router.replace('/auth/login');
        throw new TokenExpiredError('Exception during refresh');
      }
    }

    const result = await operation();
    return result;
  } catch (error: any) {
    if (error instanceof TokenExpiredError) {
      throw error;
    }

    if (isJWTError(error)) {
      console.error(`JWT error during ${context}:`, error);
      console.log('Redirecting to login due to JWT error');
      router.replace('/auth/login');
      throw new TokenExpiredError('JWT error during operation');
    }

    throw error;
  }
};

export const secureSupabaseQuery = {
  from: (table: string) => {
    const query = supabaseClient.from(table);

    return {
      select: (columns?: string) => {
        const selectQuery = query.select(columns);

        return {
          ...selectQuery,
          execute: async () => {
            return withTokenValidation(
              () => selectQuery,
              `select from ${table}`
            );
          },
        };
      },

      insert: (values: any) => {
        const insertQuery = query.insert(values);

        return {
          ...insertQuery,
          execute: async () => {
            return withTokenValidation(
              () => insertQuery,
              `insert into ${table}`
            );
          },
        };
      },

      update: (values: any) => {
        const updateQuery = query.update(values);

        return {
          ...updateQuery,
          execute: async () => {
            return withTokenValidation(
              () => updateQuery,
              `update ${table}`
            );
          },
        };
      },

      delete: () => {
        const deleteQuery = query.delete();

        return {
          ...deleteQuery,
          execute: async () => {
            return withTokenValidation(
              () => deleteQuery,
              `delete from ${table}`
            );
          },
        };
      },
    };
  },
};
