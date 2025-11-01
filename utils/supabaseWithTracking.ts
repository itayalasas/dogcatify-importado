import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './datadogLogger';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente de Supabase con tracking automático en Datadog
 *
 * Todas las operaciones se loguean automáticamente con:
 * - Tabla consultada
 * - Tipo de operación (select, insert, update, delete)
 * - Tiempo de ejecución
 * - Éxito/Error
 */

class TrackedSupabaseClient {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  /**
   * Proxy para operaciones con tracking
   */
  from(table: string) {
    const builder = this.client.from(table);
    const startTime = Date.now();

    // Wrapper para cada método
    const wrapMethod = (method: string, originalFn: Function) => {
      return async (...args: any[]) => {
        const operationStart = Date.now();

        try {
          const result = await originalFn.apply(builder, args);
          const duration = Date.now() - operationStart;

          // Log successful operation
          logger.info(`Supabase Query: ${table}`, {
            table,
            operation: method,
            duration,
            success: !result.error,
            hasData: !!result.data,
            dataCount: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
          });

          if (result.error) {
            logger.error(`Supabase Error: ${table}`, result.error as Error, {
              table,
              operation: method,
              duration,
            });
          }

          return result;
        } catch (error) {
          const duration = Date.now() - operationStart;

          logger.error(`Supabase Exception: ${table}`, error as Error, {
            table,
            operation: method,
            duration,
          });

          throw error;
        }
      };
    };

    // Wrap common methods
    return {
      select: wrapMethod('select', builder.select.bind(builder)),
      insert: wrapMethod('insert', builder.insert.bind(builder)),
      update: wrapMethod('update', builder.update.bind(builder)),
      delete: wrapMethod('delete', builder.delete.bind(builder)),
      upsert: wrapMethod('upsert', builder.upsert.bind(builder)),

      // Filters - return the builder for chaining
      eq: (column: string, value: any) => {
        logger.debug(`Query filter: ${table}.${column} = ${value}`);
        return builder.eq(column, value);
      },
      neq: (column: string, value: any) => {
        logger.debug(`Query filter: ${table}.${column} != ${value}`);
        return builder.neq(column, value);
      },
      gt: (column: string, value: any) => builder.gt(column, value),
      gte: (column: string, value: any) => builder.gte(column, value),
      lt: (column: string, value: any) => builder.lt(column, value),
      lte: (column: string, value: any) => builder.lte(column, value),
      like: (column: string, pattern: string) => builder.like(column, pattern),
      ilike: (column: string, pattern: string) => builder.ilike(column, pattern),
      is: (column: string, value: any) => builder.is(column, value),
      in: (column: string, values: any[]) => builder.in(column, values),
      contains: (column: string, value: any) => builder.contains(column, value),
      containedBy: (column: string, value: any) => builder.containedBy(column, value),
      rangeGt: (column: string, range: string) => builder.rangeGt(column, range),
      rangeGte: (column: string, range: string) => builder.rangeGte(column, range),
      rangeLt: (column: string, range: string) => builder.rangeLt(column, range),
      rangeLte: (column: string, range: string) => builder.rangeLte(column, range),
      rangeAdjacent: (column: string, range: string) => builder.rangeAdjacent(column, range),
      overlaps: (column: string, value: any) => builder.overlaps(column, value),
      textSearch: (column: string, query: string, config?: any) => builder.textSearch(column, query, config),
      match: (query: Record<string, any>) => builder.match(query),
      not: (column: string, operator: string, value: any) => builder.not(column, operator, value),
      or: (filters: string) => builder.or(filters),
      filter: (column: string, operator: string, value: any) => builder.filter(column, operator, value),

      // Modifiers
      order: (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => builder.order(column, options),
      limit: (count: number) => builder.limit(count),
      range: (from: number, to: number) => builder.range(from, to),
      single: () => builder.single(),
      maybeSingle: () => builder.maybeSingle(),
    };
  }

  /**
   * Auth con tracking
   */
  get auth() {
    const originalAuth = this.client.auth;

    return {
      ...originalAuth,

      signUp: async (credentials: any) => {
        const start = Date.now();
        try {
          const result = await originalAuth.signUp(credentials);
          const duration = Date.now() - start;

          logger.info('Auth: Sign Up', {
            success: !result.error,
            duration,
            hasSession: !!result.data?.session,
          });

          return result;
        } catch (error) {
          logger.error('Auth Error: Sign Up', error as Error);
          throw error;
        }
      },

      signInWithPassword: async (credentials: any) => {
        const start = Date.now();
        try {
          const result = await originalAuth.signInWithPassword(credentials);
          const duration = Date.now() - start;

          logger.info('Auth: Sign In', {
            success: !result.error,
            duration,
            hasSession: !!result.data?.session,
          });

          return result;
        } catch (error) {
          logger.error('Auth Error: Sign In', error as Error);
          throw error;
        }
      },

      signOut: async () => {
        const start = Date.now();
        try {
          const result = await originalAuth.signOut();
          const duration = Date.now() - start;

          logger.info('Auth: Sign Out', {
            success: true,
            duration,
          });

          return result;
        } catch (error) {
          logger.error('Auth Error: Sign Out', error as Error);
          throw error;
        }
      },

      resetPasswordForEmail: async (email: string, options?: any) => {
        const start = Date.now();
        try {
          const result = await originalAuth.resetPasswordForEmail(email, options);
          const duration = Date.now() - start;

          logger.info('Auth: Reset Password', {
            success: !result.error,
            duration,
          });

          return result;
        } catch (error) {
          logger.error('Auth Error: Reset Password', error as Error);
          throw error;
        }
      },

      getSession: async () => {
        const result = await originalAuth.getSession();
        logger.debug('Auth: Get Session', {
          hasSession: !!result.data?.session,
        });
        return result;
      },

      onAuthStateChange: (callback: any) => {
        return originalAuth.onAuthStateChange((event, session) => {
          logger.info('Auth: State Change', {
            event,
            hasSession: !!session,
          });
          callback(event, session);
        });
      },
    };
  }

  /**
   * Storage con tracking
   */
  get storage() {
    const originalStorage = this.client.storage;

    return {
      from: (bucket: string) => {
        const bucketApi = originalStorage.from(bucket);

        return {
          ...bucketApi,

          upload: async (path: string, file: any, options?: any) => {
            const start = Date.now();
            try {
              const result = await bucketApi.upload(path, file, options);
              const duration = Date.now() - start;

              logger.info('Storage: Upload', {
                bucket,
                path,
                success: !result.error,
                duration,
              });

              return result;
            } catch (error) {
              logger.error('Storage Error: Upload', error as Error, {
                bucket,
                path,
              });
              throw error;
            }
          },

          download: async (path: string) => {
            const start = Date.now();
            try {
              const result = await bucketApi.download(path);
              const duration = Date.now() - start;

              logger.info('Storage: Download', {
                bucket,
                path,
                success: !result.error,
                duration,
              });

              return result;
            } catch (error) {
              logger.error('Storage Error: Download', error as Error, {
                bucket,
                path,
              });
              throw error;
            }
          },

          remove: async (paths: string[]) => {
            const start = Date.now();
            try {
              const result = await bucketApi.remove(paths);
              const duration = Date.now() - start;

              logger.info('Storage: Remove', {
                bucket,
                pathCount: paths.length,
                success: !result.error,
                duration,
              });

              return result;
            } catch (error) {
              logger.error('Storage Error: Remove', error as Error, {
                bucket,
                pathCount: paths.length,
              });
              throw error;
            }
          },

          getPublicUrl: (path: string) => {
            logger.debug('Storage: Get Public URL', { bucket, path });
            return bucketApi.getPublicUrl(path);
          },
        };
      },
    };
  }

  /**
   * Acceso directo a funciones edge
   */
  get functions() {
    const originalFunctions = this.client.functions;

    return {
      invoke: async (functionName: string, options?: any) => {
        const start = Date.now();
        try {
          const result = await originalFunctions.invoke(functionName, options);
          const duration = Date.now() - start;

          logger.info(`Edge Function: ${functionName}`, {
            function: functionName,
            success: !result.error,
            duration,
            statusCode: result.status,
          });

          return result;
        } catch (error) {
          logger.error(`Edge Function Error: ${functionName}`, error as Error, {
            function: functionName,
          });
          throw error;
        }
      },
    };
  }

  /**
   * RPC calls con tracking
   */
  async rpc(fn: string, params?: any) {
    const start = Date.now();
    try {
      const result = await this.client.rpc(fn, params);
      const duration = Date.now() - start;

      logger.info(`RPC Call: ${fn}`, {
        function: fn,
        success: !result.error,
        duration,
      });

      return result;
    } catch (error) {
      logger.error(`RPC Error: ${fn}`, error as Error, {
        function: fn,
      });
      throw error;
    }
  }
}

// Export instancia global
export const supabaseTracked = new TrackedSupabaseClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// Export también el tipo para TypeScript
export type { TrackedSupabaseClient };
