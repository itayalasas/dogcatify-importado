import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabase';

interface AppConfig {
  email_api_url: string;
  email_api_key: string;
  mercadopago_public_key: string;
  app_name: string;
  support_email: string;
  max_file_upload_size: number;
  enable_notifications: boolean;
}

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
  getConfig: <K extends keyof AppConfig>(key: K) => AppConfig[K] | null;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const trimTrailingSlash = (value: string) => String(value || '').trim().replace(/\/+$/, '');

const sameSupabaseHost = (candidateUrl: string, baseUrl: string): boolean => {
  try {
    return new URL(candidateUrl).host === new URL(baseUrl).host;
  } catch {
    return false;
  }
};

const isSupabaseFunctionsUrl = (candidateUrl: string): boolean => {
  try {
    const parsed = new URL(candidateUrl);
    return parsed.host.endsWith('.supabase.co') && parsed.pathname.includes('/functions/v1/');
  } catch {
    return false;
  }
};

const matchesSupabaseFunctionPath = (candidateUrl: string, functionName: string): boolean => {
  try {
    const parsed = new URL(candidateUrl);
    return parsed.pathname.replace(/\/+$/, '') === `/functions/v1/${functionName}`;
  } catch {
    return false;
  }
};

const resolveDefaultEmailApiUrl = (): string => {
  const explicitEmailUrl = process.env.EXPO_PUBLIC_EMAIL_API_URL?.trim();
  const supabaseUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_SUPABASE_URL || '');
  if (
    explicitEmailUrl &&
    isSupabaseFunctionsUrl(explicitEmailUrl) &&
    (
      (supabaseUrl && !sameSupabaseHost(explicitEmailUrl, supabaseUrl)) ||
      !matchesSupabaseFunctionPath(explicitEmailUrl, 'send-email')
    )
  ) {
    console.warn(
      '[ConfigContext] Ignoring EXPO_PUBLIC_EMAIL_API_URL because it does not point to the current send-email function. Using current project fallback instead:',
      explicitEmailUrl,
    );
    return supabaseUrl ? `${supabaseUrl}/functions/v1/send-email` : '';
  }

  return explicitEmailUrl || (supabaseUrl ? `${supabaseUrl}/functions/v1/send-email` : '');
};

const resolveDefaultEmailApiKey = (): string => {
  return (
    process.env.EXPO_PUBLIC_EMAIL_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    ''
  );
};

const DEFAULT_CONFIG: AppConfig = {
  email_api_url: resolveDefaultEmailApiUrl(),
  email_api_key: resolveDefaultEmailApiKey(),
  mercadopago_public_key: '',
  app_name: 'DogCatify',
  support_email: 'support@dogcatify.com',
  max_file_upload_size: 10485760,
  enable_notifications: true,
};

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  console.log('[ConfigContext] Provider initializing...');
  const [config, setConfig] = useState<AppConfig | null>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    try {
      console.log('[ConfigContext] loadConfig started');
      setLoading(true);
      setError(null);

      // Check if supabaseClient is available
      if (!supabaseClient) {
        console.warn('[ConfigContext] Supabase client not initialized, using default config');
        setConfig(DEFAULT_CONFIG);
        setLoading(false);
        return;
      }

      console.log('[ConfigContext] Fetching config from database...');

      const { data, error: fetchError } = await supabaseClient
        .from('app_config')
        .select('key, value');

      if (fetchError) {
        console.warn('[ConfigContext] Error loading config from database, using defaults:', fetchError.message);
        setConfig(DEFAULT_CONFIG);
        return;
      }

      console.log('[ConfigContext] Config data received:', data?.length || 0, 'items');

      if (!data || data.length === 0) {
        console.log('[ConfigContext] No config data, using defaults');
        setConfig(DEFAULT_CONFIG);
        return;
      }

      const configObject = data.reduce((acc, item) => {
        acc[item.key as keyof AppConfig] = item.value;
        return acc;
      }, {} as any);

      const supabaseUrl = trimTrailingSlash(process.env.EXPO_PUBLIC_SUPABASE_URL || '');
      const configuredEmailUrl = trimTrailingSlash(String(configObject.email_api_url || ''));
      const shouldFallbackToDefault =
        configuredEmailUrl &&
        isSupabaseFunctionsUrl(configuredEmailUrl) &&
        (
          (supabaseUrl && !sameSupabaseHost(configuredEmailUrl, supabaseUrl)) ||
          !matchesSupabaseFunctionPath(configuredEmailUrl, 'send-email')
        );

      if (shouldFallbackToDefault) {
        console.warn(
          '[ConfigContext] Ignoring app_config.email_api_url because it does not point to the current send-email function. Using default config instead:',
          configuredEmailUrl,
        );
      }

      console.log('[ConfigContext] Config loaded successfully');
      setConfig({
        ...DEFAULT_CONFIG,
        ...configObject,
        email_api_url: shouldFallbackToDefault ? DEFAULT_CONFIG.email_api_url : (configuredEmailUrl || DEFAULT_CONFIG.email_api_url),
      });
    } catch (err) {
      console.error('[ConfigContext] Error loading config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConfig(DEFAULT_CONFIG);
    } finally {
      console.log('[ConfigContext] loadConfig finished, loading=false');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();

    // Only set up real-time subscription if supabaseClient is available
    if (!supabaseClient) {
      return;
    }

    const channel = supabaseClient
      .channel('app_config_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_config',
        },
        () => {
          loadConfig();
        }
      )
      .subscribe();

    return () => {
      if (supabaseClient) {
        supabaseClient.removeChannel(channel);
      }
    };
  }, []);

  const getConfig = <K extends keyof AppConfig>(key: K): AppConfig[K] | null => {
    return config ? config[key] : null;
  };

  return (
    <ConfigContext.Provider
      value={{
        config,
        loading,
        error,
        refreshConfig: loadConfig,
        getConfig,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
