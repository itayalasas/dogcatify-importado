import { supabaseClient } from '@/lib/supabase';
import { envConfig } from './envConfig';

let cachedConfig: Record<string, any> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

const trimTrailingSlash = (value: string) => String(value || '').trim().replace(/\/+$/, '');

// This app's real Supabase URL/anon key are loaded asynchronously at runtime
// by envConfig (see utils/envConfig.ts), not via process.env.EXPO_PUBLIC_*
// (the .env entries for those are commented out on purpose). Reading
// process.env.EXPO_PUBLIC_SUPABASE_URL directly here — as this file used to
// — always returned '', which silently disabled the cross-project guard
// below: it let a stale/wrong email_api_url stored in the app_config table
// (from a since-abandoned Supabase project) pass through unchecked, because
// the guard's own "does this even look like our project?" check never had a
// real base URL to compare against.
const ensureRuntimeEnvConfig = async (): Promise<void> => {
  if (!envConfig.isInitialized()) {
    await envConfig.initialize();
  }
};

const getSupabaseBaseUrl = (): string => trimTrailingSlash(envConfig.get('EXPO_PUBLIC_SUPABASE_URL') || '');

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
  const explicitEmailUrl = envConfig.get('EXPO_PUBLIC_EMAIL_API_URL')?.trim();
  const supabaseUrl = getSupabaseBaseUrl();
  const fallbackEmailUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/send-email` : '';

  if (explicitEmailUrl) {
    if (
      isSupabaseFunctionsUrl(explicitEmailUrl) &&
      (
        (supabaseUrl && !sameSupabaseHost(explicitEmailUrl, supabaseUrl)) ||
        !matchesSupabaseFunctionPath(explicitEmailUrl, 'send-email')
      )
    ) {
      console.warn(
        '[appConfig] Ignoring EXPO_PUBLIC_EMAIL_API_URL because it does not point to the current project send-email function. Using current project fallback instead:',
        explicitEmailUrl,
      );
      return fallbackEmailUrl;
    }

    return explicitEmailUrl;
  }

  return fallbackEmailUrl;
};

const resolveDefaultEmailApiKey = (): string => {
  return (
    envConfig.get('EXPO_PUBLIC_EMAIL_API_KEY')?.trim() ||
    envConfig.get('EXPO_PUBLIC_SUPABASE_ANON_KEY')?.trim() ||
    ''
  );
};

const STATIC_DEFAULTS = {
  mercadopago_public_key: '',
  app_name: 'DogCatify',
  support_email: 'support@dogcatify.com',
  max_file_upload_size: 10485760,
  enable_notifications: true,
};

const buildFallbackConfig = () => ({
  email_api_url: resolveDefaultEmailApiUrl(),
  email_api_key: resolveDefaultEmailApiKey(),
  mercadopago_public_key: envConfig.get('EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY')?.trim() || STATIC_DEFAULTS.mercadopago_public_key,
  app_name: STATIC_DEFAULTS.app_name,
  support_email: STATIC_DEFAULTS.support_email,
  max_file_upload_size: STATIC_DEFAULTS.max_file_upload_size,
  enable_notifications: STATIC_DEFAULTS.enable_notifications,
});

const normalizeEmailApiConfig = (emailApiUrl: string, emailApiKey: string, fallbackConfig: ReturnType<typeof buildFallbackConfig>) => {
  const baseUrl = getSupabaseBaseUrl();
  const normalizedUrl = trimTrailingSlash(emailApiUrl);
  const normalizedKey = String(emailApiKey || '').trim();

  if (
    normalizedUrl &&
    isSupabaseFunctionsUrl(normalizedUrl) &&
    (
      (baseUrl && !sameSupabaseHost(normalizedUrl, baseUrl)) ||
      !matchesSupabaseFunctionPath(normalizedUrl, 'send-email')
    )
  ) {
    console.warn(
      '[appConfig] Ignoring app_config.email_api_url because it does not point to the current project send-email function. Falling back to current project settings.',
      normalizedUrl,
    );
    return {
      email_api_url: fallbackConfig.email_api_url,
      email_api_key: fallbackConfig.email_api_key,
    };
  }

  return {
    email_api_url: normalizedUrl || fallbackConfig.email_api_url,
    email_api_key: normalizedKey || fallbackConfig.email_api_key,
  };
};

export async function getAppConfig(forceRefresh = false): Promise<Record<string, any>> {
  const now = Date.now();

  if (!forceRefresh && cachedConfig && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedConfig;
  }

  await ensureRuntimeEnvConfig();
  const fallbackConfig = buildFallbackConfig();

  try {
    const { data, error } = await supabaseClient
      .from('app_config')
      .select('key, value');

    if (error) {
      console.warn('Could not fetch app config from database, using fallback:', error);
      cachedConfig = fallbackConfig;
      lastFetchTime = now;
      return cachedConfig;
    }

    if (!data || data.length === 0) {
      console.warn('No config found in database, using fallback');
      cachedConfig = fallbackConfig;
      lastFetchTime = now;
      return cachedConfig;
    }

    const configObject = data.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>);

    const mergedConfig = { ...fallbackConfig, ...configObject };
    const safeEmailConfig = normalizeEmailApiConfig(
      String(mergedConfig.email_api_url || ''),
      String(mergedConfig.email_api_key || ''),
      fallbackConfig,
    );

    cachedConfig = {
      ...mergedConfig,
      ...safeEmailConfig,
    };
    lastFetchTime = now;

    return cachedConfig;
  } catch (err) {
    console.error('Error fetching app config:', err);
    return fallbackConfig;
  }
}

export async function getConfigValue<T = any>(key: string, defaultValue?: T): Promise<T> {
  const config = await getAppConfig();
  if (config[key] !== undefined) {
    return config[key] as T;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  await ensureRuntimeEnvConfig();
  return buildFallbackConfig()[key as keyof ReturnType<typeof buildFallbackConfig>] as T;
}

export function clearConfigCache() {
  cachedConfig = null;
  lastFetchTime = 0;
}
