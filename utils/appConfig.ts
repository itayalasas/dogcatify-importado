import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

let cachedConfig: Record<string, any> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

const DEFAULT_CONFIG = {
  email_api_url: 'https://qhxnubuxjtlsvqgxhpfl.supabase.co/functions/v1/send-email',
  email_api_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeG51YnV4anRsc3ZxZ3hocGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjk4MTc3NzMsImV4cCI6MjA0NTM5Mzc3M30.GFXrZGHzevh21eIEy-gq6VZxq58wBgwsz_iRVS6m9iU',
  mercadopago_public_key: '',
  app_name: 'DogCatify',
  support_email: 'support@dogcatify.com',
  max_file_upload_size: 10485760,
  enable_notifications: true,
};

const fallbackConfig = {
  email_api_url: Constants.expoConfig?.extra?.EXPO_PUBLIC_EMAIL_API_URL ||
                 process.env.EXPO_PUBLIC_EMAIL_API_URL ||
                 DEFAULT_CONFIG.email_api_url,
  email_api_key: Constants.expoConfig?.extra?.EXPO_PUBLIC_EMAIL_API_KEY ||
                 process.env.EXPO_PUBLIC_EMAIL_API_KEY ||
                 DEFAULT_CONFIG.email_api_key,
  mercadopago_public_key: Constants.expoConfig?.extra?.EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY ||
                          process.env.EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY ||
                          DEFAULT_CONFIG.mercadopago_public_key,
  app_name: DEFAULT_CONFIG.app_name,
  support_email: DEFAULT_CONFIG.support_email,
  max_file_upload_size: DEFAULT_CONFIG.max_file_upload_size,
  enable_notifications: DEFAULT_CONFIG.enable_notifications,
};

export async function getAppConfig(forceRefresh = false): Promise<Record<string, any>> {
  const now = Date.now();

  if (!forceRefresh && cachedConfig && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedConfig;
  }

  try {
    const { data, error } = await supabase
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

    cachedConfig = { ...fallbackConfig, ...configObject };
    lastFetchTime = now;

    return cachedConfig;
  } catch (err) {
    console.error('Error fetching app config:', err);
    return fallbackConfig;
  }
}

export async function getConfigValue<T = any>(key: string, defaultValue?: T): Promise<T> {
  const config = await getAppConfig();
  return (config[key] as T) ?? defaultValue ?? (fallbackConfig[key as keyof typeof fallbackConfig] as T);
}

export function clearConfigCache() {
  cachedConfig = null;
  lastFetchTime = 0;
}
