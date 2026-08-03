import AsyncStorage from '@react-native-async-storage/async-storage';

interface EnvironmentVariables {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  EXPO_ROUTER_APP_ROOT: string;
  EXPO_PUBLIC_PROJECT_ID: string;
  EXPO_PUBLIC_PRIVACY_POLICY_URL: string;
  EXPO_PUBLIC_TERMS_OF_SERVICE_URL: string;
  EXPO_PUBLIC_APP_DOMAIN: string;
  EXPO_PUBLIC_NOMINATIM_BASE_URL: string;
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: string;
  EXPO_PUBLIC_EMAIL_API_URL: string;
  EXPO_PUBLIC_CONFIRM_EMAIL_API_URL: string;
  EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID: string;
  EXPO_PUBLIC_DATADOG_CLIENT_TOKEN: string;
  EXPO_PUBLIC_DATADOG_APPLICATION_ID: string;
  EXPO_PUBLIC_DATADOG_ENV: string;
  [key: string]: string;
}

interface ApiGatewayResponse {
  project_name: string;
  description: string;
  variables: EnvironmentVariables;
  updated_at: string;
}

const PUBLIC_CONFIG_KEYS = new Set<keyof EnvironmentVariables>([
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_ROUTER_APP_ROOT',
  'EXPO_PUBLIC_PROJECT_ID',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_TERMS_OF_SERVICE_URL',
  'EXPO_PUBLIC_APP_DOMAIN',
  'EXPO_PUBLIC_NOMINATIM_BASE_URL',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_EMAIL_API_URL',
  'EXPO_PUBLIC_CONFIRM_EMAIL_API_URL',
  'EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID',
  'EXPO_PUBLIC_DATADOG_CLIENT_TOKEN',
  'EXPO_PUBLIC_DATADOG_APPLICATION_ID',
  'EXPO_PUBLIC_DATADOG_ENV',
]);

const sanitizePublicConfig = (value: unknown): EnvironmentVariables | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const sanitized: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entryValue]) => {
    if (PUBLIC_CONFIG_KEYS.has(key) && typeof entryValue === 'string' && entryValue.trim()) {
      sanitized[key] = entryValue.trim();
    }
  });

  if (!sanitized.EXPO_PUBLIC_SUPABASE_URL || !sanitized.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  return sanitized as EnvironmentVariables;
};

// Global state que sobrevive al Hot Reload de Metro
// @ts-ignore
if (!global.__envConfig) {
  // @ts-ignore
  global.__envConfig = null;
}
// @ts-ignore
if (!global.__envInitialized) {
  // @ts-ignore
  global.__envInitialized = false;
}
// @ts-ignore
if (!global.__envLoading) {
  // @ts-ignore
  global.__envLoading = false;
}

class EnvConfigService {
  private static instance: EnvConfigService;

  private constructor() {
    // @ts-ignore
  }

  public static getInstance(): EnvConfigService {
    if (!EnvConfigService.instance) {
      EnvConfigService.instance = new EnvConfigService();
    }
    return EnvConfigService.instance;
  }

  private get config(): EnvironmentVariables | null {
    // @ts-ignore
    return global.__envConfig;
  }

  private set config(value: EnvironmentVariables | null) {
    // @ts-ignore
    global.__envConfig = value;
  }

  private get initialized(): boolean {
    // @ts-ignore
    return global.__envInitialized;
  }

  private set initialized(value: boolean) {
    // @ts-ignore
    global.__envInitialized = value;
  }

  private get loading(): boolean {
    // @ts-ignore
    return global.__envLoading;
  }

  private set loading(value: boolean) {
    // @ts-ignore
    global.__envLoading = value;
  }

  private initPromise: Promise<void> | null = null;

  /**
   * Inicializa la configuración cargándola desde el API Gateway
   */
  public async initialize(forceRefresh = false): Promise<void> {
    // Si ya está inicializado, retornar inmediatamente salvo que pidamos refresco forzado
    if (!forceRefresh && this.initialized && this.config) {
      return;
    }

    // Si ya está cargando, esperar a que termine
    if (this.loading && this.initPromise) {
      if (forceRefresh) {
        return this.initPromise
          .catch((error) => {
          })
          .then(async () => {
            this.loading = false;
            this.initPromise = null;
            await this.initialize(true);
          });
      }

      return this.initPromise;
    }

    this.loading = true;
    this.initPromise = this._loadConfig(forceRefresh);

    try {
      await this.initPromise;
    } finally {
      this.loading = false;
      this.initPromise = null;
    }
  }

  private async _loadConfig(forceRefresh = false): Promise<void> {
    try {
      const cachedConfig = await this._loadFromCache();
      const embeddedConfig = this._loadFromProcessEnv();
      const bootstrapConfig = sanitizePublicConfig({
        ...(cachedConfig || {}),
        ...(embeddedConfig || {}),
      });

      if (!bootstrapConfig) {
        throw new Error(
          'No se pudo iniciar la aplicación. Actualiza la app o verifica la configuración del entorno.'
        );
      }

      let resolvedConfig = bootstrapConfig;
      try {
        const remoteConfig = await this._fetchPublicConfig(bootstrapConfig);
        resolvedConfig = sanitizePublicConfig({
          ...bootstrapConfig,
          ...remoteConfig,
        }) || bootstrapConfig;
      } catch (remoteError) {
        // La configuración pública embebida o cacheada mantiene el inicio disponible
        // cuando el servicio remoto está temporalmente fuera de línea.
      }

      this.config = resolvedConfig;
      this.initialized = true;
      await this._saveToCache(resolvedConfig);
    } catch (error: any) {
      throw error;
    }
  }

  private async _fetchPublicConfig(bootstrap: EnvironmentVariables): Promise<EnvironmentVariables> {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 15000;
    const supabaseUrl = bootstrap.EXPO_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
    const anonKey = bootstrap.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const url = `${supabaseUrl}/functions/v1/mobile-config`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {

        // Timeout de 60 segundos para redes lentas
        const controller = new AbortController();
        let timeoutReject: ((error: Error) => void) | null = null;
        const timeoutPromise = new Promise<Response>((_, reject) => {
          timeoutReject = reject;
        });
        const timeoutId = setTimeout(() => {
          controller.abort();
          timeoutReject?.(new Error(`API Gateway request timeout after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);

        const fetchPromise = fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        let response!: Response;
        try {
          response = await Promise.race([fetchPromise, timeoutPromise]);
        } finally {
          clearTimeout(timeoutId);
        }


        if (!response.ok) {

          const gatewayError = new Error(`API Gateway returned ${response.status}: ${response.statusText}`);
          (gatewayError as any).retryable = response.status >= 500;
          throw gatewayError;
        }

        const data: ApiGatewayResponse = await response.json();

        if (!data.variables) {
          throw new Error('Invalid API Gateway response: missing variables');
        }


        const publicConfig = sanitizePublicConfig(data.variables);
        if (!publicConfig) {
          throw new Error('Invalid public configuration response');
        }

        return publicConfig;
      } catch (error: any) {
        const isLastAttempt = attempt === MAX_RETRIES;

        if (error.name === 'AbortError' || error.message?.includes('request timeout')) {

          if (!isLastAttempt) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          throw new Error('La conexión es muy lenta. Por favor, verifica tu conexión a internet y reintenta.');
        }


        if ((error as any).retryable === false) {
          throw error;
        }

        if (error.message?.includes('Network request failed')) {
          if (!isLastAttempt) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          throw new Error('No se pudo conectar al servidor. Verifica tu conexión a internet.');
        }

        // Si es el último intento, lanzar el error
        if (isLastAttempt) {
          throw error;
        }

        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Este código nunca debería ejecutarse, pero TypeScript lo requiere
    throw new Error('Failed to fetch configuration after all retries');
  }

  private async _loadFromCache(): Promise<EnvironmentVariables | null> {
    try {
      const cached = await AsyncStorage.getItem('@env_config');
      if (cached) {
        const sanitized = sanitizePublicConfig(JSON.parse(cached));
        if (sanitized) {
          await AsyncStorage.setItem('@env_config', JSON.stringify(sanitized));
          return sanitized;
        }

        await AsyncStorage.removeItem('@env_config');
      }
    } catch (error) {
    }
    return null;
  }

  private async _saveToCache(config: EnvironmentVariables): Promise<void> {
    try {
      const sanitized = sanitizePublicConfig(config);
      if (sanitized) {
        await AsyncStorage.setItem('@env_config', JSON.stringify(sanitized));
      }
    } catch (error) {
    }
  }

  private _loadFromProcessEnv(): EnvironmentVariables | null {
    try {
      if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        return sanitizePublicConfig({
          EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
          EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          EXPO_ROUTER_APP_ROOT: process.env.EXPO_ROUTER_APP_ROOT || 'app',
          EXPO_PUBLIC_PROJECT_ID: process.env.EXPO_PUBLIC_PROJECT_ID || '',
          EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '',
          EXPO_PUBLIC_TERMS_OF_SERVICE_URL: process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL || '',
          EXPO_PUBLIC_APP_DOMAIN: process.env.EXPO_PUBLIC_APP_DOMAIN || '',
          EXPO_PUBLIC_NOMINATIM_BASE_URL: process.env.EXPO_PUBLIC_NOMINATIM_BASE_URL || '',
          EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
          EXPO_PUBLIC_EMAIL_API_URL: process.env.EXPO_PUBLIC_EMAIL_API_URL || '',
          EXPO_PUBLIC_CONFIRM_EMAIL_API_URL: process.env.EXPO_PUBLIC_CONFIRM_EMAIL_API_URL || '',
          EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID: process.env.EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID || '',
          EXPO_PUBLIC_DATADOG_CLIENT_TOKEN: process.env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN || '',
          EXPO_PUBLIC_DATADOG_APPLICATION_ID: process.env.EXPO_PUBLIC_DATADOG_APPLICATION_ID || '',
          EXPO_PUBLIC_DATADOG_ENV: process.env.EXPO_PUBLIC_DATADOG_ENV || '',
        });
      }
    } catch (error) {
    }
    return null;
  }


  /**
   * Obtiene una variable de configuración
   */
  public get(key: string): string | undefined {
    if (!this.initialized || !this.config) {
      return undefined;
    }
    const value = this.config[key];
    return value;
  }

  /**
   * Obtiene una variable de configuración con valor por defecto
   */
  public getOrDefault(key: string, defaultValue: string): string {
    return this.get(key) || defaultValue;
  }

  /**
   * Verifica si la configuración está inicializada
   */
  public isInitialized(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Obtiene toda la configuración
   */
  public getAll(): EnvironmentVariables | null {
    return this.config;
  }

  /**
   * Limpia la caché de configuración
   */
  public async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem('@env_config');
      this.config = null;
      this.initialized = false;
    } catch (error) {
    }
  }

  /**
   * Fuerza una recarga de la configuración
   */
  public async reload(): Promise<void> {
    this.initialized = false;
    this.config = null;
    this.loading = false;
    this.initPromise = null;
    await this.initialize(true);
  }
}

// Export singleton instance
export const envConfig = EnvConfigService.getInstance();

// Helper functions para compatibilidad
export const getEnv = (key: string): string | undefined => envConfig.get(key);
export const getEnvOrDefault = (key: string, defaultValue: string): string => envConfig.getOrDefault(key, defaultValue);
export const isEnvInitialized = (): boolean => envConfig.isInitialized();
