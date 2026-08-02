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
  operation: () => T | Promise<T>,
  context = 'operation'
): Promise<Awaited<T>> => {
  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError) {

      if (isJWTError(sessionError)) {
        router.replace('/auth/login');
        throw new TokenExpiredError('Session invalid');
      }

      throw sessionError;
    }

    if (!session) {
      router.replace('/auth/login');
      throw new TokenExpiredError('No session found');
    }

    const now = Math.floor(Date.now() / 1000);
    const tokenExp = session.expires_at || 0;

    if (now >= tokenExp) {

      try {
        const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          router.replace('/auth/login');
          throw new TokenExpiredError('Failed to refresh session');
        }

      } catch (refreshError) {
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
      router.replace('/auth/login');
      throw new TokenExpiredError('JWT error during operation');
    }

    throw error;
  }
};

export const secureSupabaseQuery = {
  from: (table: string) => {
    const query: any = supabaseClient.from(table);

    return {
      select: (columns?: string) => {
        return {
          execute: async () => {
            return withTokenValidation(
              async () => await query.select(columns),
              `select from ${table}`
            );
          },
        };
      },

      insert: (values: any) => {
        return {
          execute: async () => {
            return withTokenValidation(
              async () => await query.insert(values),
              `insert into ${table}`
            );
          },
        };
      },

      update: (values: any) => {
        return {
          execute: async () => {
            return withTokenValidation(
              async () => await query.update(values),
              `update ${table}`
            );
          },
        };
      },

      delete: () => {
        return {
          execute: async () => {
            return withTokenValidation(
              async () => await query.delete(),
              `delete from ${table}`
            );
          },
        };
      },
    };
  },
};
