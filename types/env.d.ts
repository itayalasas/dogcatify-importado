declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
      EXPO_PUBLIC_EMAIL_API_URL: string;
      EXPO_PUBLIC_EMAIL_API_KEY: string;
      EXPO_PUBLIC_APP_DOMAIN?: string;
      EXPO_PUBLIC_APP_URL?: string;
      EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?: string;
    }
  }
}

export {};
