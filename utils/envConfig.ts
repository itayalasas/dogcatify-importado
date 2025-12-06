import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EnvironmentVariables {
  EXPO_PUBLIC_SUPABASE_URL: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  EXPO_ROUTER_APP_ROOT: string;
  EXPO_PUBLIC_PROJECT_ID: string;
  EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: string;
  EXPO_PUBLIC_PRIVACY_POLICY_URL: string;
  EXPO_PUBLIC_TERMS_OF_SERVICE_URL: string;
  EXPO_PUBLIC_APP_DOMAIN: string;
  EXPO_PUBLIC_NOMINATIM_BASE_URL: string;
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: string;
  FIREBASE_PRIVATE_KEY_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_CLIENT_ID: string;
  FIREBASE_CLIENT_CERT_URL: string;
  EXPO_PUBLIC_EMAIL_API_URL: string;
  EXPO_PUBLIC_EMAIL_API_KEY: string;
  [key: string]: string;
}

interface ApiGatewayResponse {
  project_name: string;
  description: string;
  variables: EnvironmentVariables;
  updated_at: string;
}

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
    console.log('[EnvConfig] 🏗️ Constructor - Global state initialized:', global.__envInitialized);
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
  public async initialize(): Promise<void> {
    // Si ya está inicializado, retornar inmediatamente
    if (this.initialized && this.config) {
      console.log('[EnvConfig] ✅ Already initialized, skipping');
      return;
    }

    // Si ya está cargando, esperar a que termine
    if (this.loading && this.initPromise) {
      console.log('[EnvConfig] ⏳ Already loading, waiting...');
      return this.initPromise;
    }

    this.loading = true;
    this.initPromise = this._loadConfig();

    try {
      await this.initPromise;
    } finally {
      this.loading = false;
      this.initPromise = null;
    }
  }

  private async _loadConfig(): Promise<void> {
    try {
      console.log('[EnvConfig] 🚀 Initializing environment configuration...');

      // 1. Intentar cargar desde caché primero (más rápido)
      const cachedConfig = await this._loadFromCache();
      if (cachedConfig) {
        this.config = cachedConfig;
        console.log('[EnvConfig] 📦 Loaded from cache');
        this.initialized = true;
        return;
      }

      // 2. Intentar usar variables de entorno directamente
      console.log('[EnvConfig] 🔄 Loading from process.env...');
      const envVars = this._loadFromProcessEnv();

      if (envVars) {
        this.config = envVars;
        this.initialized = true;
        // Guardar en caché
        await this._saveToCache(envVars);
        console.log('[EnvConfig] ✅ Configuration loaded from process.env');
        return;
      }

      // 3. Para APKs compilados, usar API Gateway
      const apiGatewayConfig = Constants.expoConfig?.extra?.apiGateway;
      console.log('[EnvConfig] 🔍 API Gateway config:', {
        hasUrl: !!apiGatewayConfig?.url,
        hasApiKey: !!apiGatewayConfig?.apiKey,
        url: apiGatewayConfig?.url,
      });

      if (apiGatewayConfig?.url && apiGatewayConfig?.apiKey) {
        try {
          console.log('[EnvConfig] 🌐 Loading from API Gateway...');
          const config = await this._fetchAndCacheConfig(apiGatewayConfig.url, apiGatewayConfig.apiKey);
          this.config = config;
          this.initialized = true;
          console.log('[EnvConfig] ✅ Configuration loaded from API Gateway');
          return;
        } catch (apiError: any) {
          console.error('[EnvConfig] ⚠️ API Gateway failed:', apiError.message);
          console.log('[EnvConfig] 🆘 Falling back to hardcoded configuration');

          // 4. Si API Gateway falla, usar hardcoded fallback
          const fallbackConfig = this._getHardcodedFallback();
          this.config = fallbackConfig;
          this.initialized = true;

          // Guardar en caché para próximas veces
          await this._saveToCache(fallbackConfig);

          console.log('[EnvConfig] ✅ Configuration loaded from hardcoded fallback');
          return;
        }
      }

      // 5. Si no hay API Gateway configurado, usar hardcoded fallback
      console.warn('[EnvConfig] ⚠️ No API Gateway configured, using hardcoded fallback');
      const fallbackConfig = this._getHardcodedFallback();
      this.config = fallbackConfig;
      this.initialized = true;

      // Guardar en caché
      await this._saveToCache(fallbackConfig);

      console.log('[EnvConfig] ✅ Configuration loaded from hardcoded fallback');
    } catch (error) {
      console.error('[EnvConfig] ❌ Critical error during initialization:', error);

      // Último recurso: usar hardcoded fallback incluso si hay error
      console.log('[EnvConfig] 🆘 Using hardcoded fallback as last resort');
      this.config = this._getHardcodedFallback();
      this.initialized = true;
    }
  }

  private async _fetchAndCacheConfig(url: string, apiKey: string): Promise<EnvironmentVariables> {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 60000; // 60 segundos para conexiones móviles lentas

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[EnvConfig] 📡 Fetching from API Gateway (attempt ${attempt}/${MAX_RETRIES})...`);
        console.log('[EnvConfig]    URL:', url);
        console.log('[EnvConfig]    API Key (first 20 chars):', apiKey.substring(0, 20) + '...');

        // Timeout de 60 segundos para redes lentas
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error(`[EnvConfig] ⏱️ API Gateway request timeout after ${TIMEOUT_MS}ms (attempt ${attempt})`);
          controller.abort();
        }, TIMEOUT_MS);

        const fetchPromise = fetch(url, {
          method: 'GET',
          headers: {
            'X-Integration-Key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        console.log('[EnvConfig] ⏳ Waiting for API Gateway response...');
        const response = await fetchPromise;
        clearTimeout(timeoutId);

        console.log('[EnvConfig] 📨 Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[EnvConfig] ❌ API Gateway error response:', errorText);

          // Si es un error 4xx, no reintentar (error del cliente)
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`API Gateway returned ${response.status}: ${response.statusText}`);
          }

          // Si es 5xx, reintentar
          throw new Error(`Server error ${response.status}, retrying...`);
        }

        const data: ApiGatewayResponse = await response.json();
        console.log('[EnvConfig] 📦 Received data keys:', Object.keys(data));

        if (!data.variables) {
          console.error('[EnvConfig] ❌ Invalid response structure');
          throw new Error('Invalid API Gateway response: missing variables');
        }

        console.log('[EnvConfig] ✅ Variables received:', Object.keys(data.variables));

        // Guardar en caché
        await this._saveToCache(data.variables);

        console.log('[EnvConfig] 💾 Configuration cached successfully');

        return data.variables;
      } catch (error: any) {
        const isLastAttempt = attempt === MAX_RETRIES;

        if (error.name === 'AbortError') {
          console.error(`[EnvConfig] ❌ Request timeout (attempt ${attempt}/${MAX_RETRIES})`);

          if (!isLastAttempt) {
            console.log(`[EnvConfig] 🔄 Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }

          throw new Error('La conexión es muy lenta. Por favor, verifica tu conexión a internet y reintenta.');
        }

        console.error(`[EnvConfig] ❌ Error fetching from API Gateway (attempt ${attempt}/${MAX_RETRIES}):`);
        console.error('[EnvConfig]    Type:', error.constructor.name);
        console.error('[EnvConfig]    Message:', error.message);

        if (error.message?.includes('Network request failed')) {
          if (!isLastAttempt) {
            console.log(`[EnvConfig] 🔄 Retrying in 2 seconds...`);
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
        console.log(`[EnvConfig] 🔄 Retrying in 2 seconds...`);
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
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('[EnvConfig] ⚠️ Error loading from cache:', error);
    }
    return null;
  }

  private async _saveToCache(config: EnvironmentVariables): Promise<void> {
    try {
      await AsyncStorage.setItem('@env_config', JSON.stringify(config));
    } catch (error) {
      console.warn('[EnvConfig] ⚠️ Error saving to cache:', error);
    }
  }

  private _loadFromProcessEnv(): EnvironmentVariables | null {
    try {
      // Intentar cargar desde process.env como fallback
      if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
        console.log('[EnvConfig] 📝 Creating config from process.env');
        return {
          EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
          EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          EXPO_ROUTER_APP_ROOT: process.env.EXPO_ROUTER_APP_ROOT || 'app',
          EXPO_PUBLIC_PROJECT_ID: process.env.EXPO_PUBLIC_PROJECT_ID || '',
          EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '',
          EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '',
          EXPO_PUBLIC_TERMS_OF_SERVICE_URL: process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL || '',
          EXPO_PUBLIC_APP_DOMAIN: process.env.EXPO_PUBLIC_APP_DOMAIN || '',
          EXPO_PUBLIC_NOMINATIM_BASE_URL: process.env.EXPO_PUBLIC_NOMINATIM_BASE_URL || '',
          EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
          FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID || '',
          FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
          FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
          FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID || '',
          FIREBASE_CLIENT_CERT_URL: process.env.FIREBASE_CLIENT_CERT_URL || '',
          EXPO_PUBLIC_EMAIL_API_URL: process.env.EXPO_PUBLIC_EMAIL_API_URL || '',
          EXPO_PUBLIC_EMAIL_API_KEY: process.env.EXPO_PUBLIC_EMAIL_API_KEY || '',
        };
      }
    } catch (error) {
      console.warn('[EnvConfig] ⚠️ Error loading from process.env:', error);
    }
    return null;
  }

  /**
   * Variables de producción embebidas como último fallback
   * Estas se usan SOLO si todo lo demás falla
   */
  private _getHardcodedFallback(): EnvironmentVariables {
    console.log('[EnvConfig] 🆘 Using hardcoded fallback configuration');
    console.warn('[EnvConfig] ⚠️ This should only happen if API Gateway and cache both failed');

    return {
      EXPO_PUBLIC_SUPABASE_URL: 'https://hpvzjuionqvgxlvhyqgz.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdnpqdWlvbnF2Z3hsdmh5cWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTcyOTMsImV4cCI6MjA3OTY5MzI5M30.IJq_nhk4S7hFwZskDTIut7Qfe8k4a5DHChEOP3-Zg9k',
      EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdnpqdWlvbnF2Z3hsdmh5cWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDExNzI5MywiZXhwIjoyMDc5NjkzMjkzfQ.10BnGYY1A8HKpFM59m4MOkOnZoYvSzac45cP3A2_t2c',
      EXPO_ROUTER_APP_ROOT: 'app',
      EXPO_PUBLIC_PROJECT_ID: 'gfazxronwllqcswdaimh',
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://dogcatify.com/privacidad',
      EXPO_PUBLIC_TERMS_OF_SERVICE_URL: 'https://dogcatify.com/terminos',
      EXPO_PUBLIC_APP_DOMAIN: 'https://dogcatify.com',
      EXPO_PUBLIC_NOMINATIM_BASE_URL: 'https://nominatim.openstreetmap.org',
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'tu_api_key_aqui',
      FIREBASE_PRIVATE_KEY_ID: '6c256092339bc53b9ba2f05b395386e5803f8ee6',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDe/WH3rqCtEYVX\nrIv5baxF9GkGr0yRaKxVYA==\n-----END PRIVATE KEY-----',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk-fbsvc340@app-mascota-7db30.iam.gserviceaccount.com',
      FIREBASE_CLIENT_ID: '109374673320703954244',
      FIREBASE_CLIENT_CERT_URL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc340%40app-mascota-7db30.iam.gserviceaccount.com',
      EXPO_PUBLIC_EMAIL_API_URL: 'https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/send-email',
      EXPO_PUBLIC_EMAIL_API_KEY: 'sk_bcaca188c1b16345e4d10adf403eb4e9e98d3fa9ff04ba053d7416fe302b7dee',
    };
  }

  /**
   * Obtiene una variable de configuración
   */
  public get(key: string): string | undefined {
    if (!this.initialized || !this.config) {
      console.warn(`[EnvConfig] ⚠️ Trying to get '${key}' before initialization`);
      console.warn(`[EnvConfig]    Initialized: ${this.initialized}, Config exists: ${!!this.config}`);
      return undefined;
    }
    const value = this.config[key];
    console.log(`[EnvConfig] 📖 Getting '${key}': ${value ? (value.substring(0, 50) + '...') : 'UNDEFINED'}`);
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
      console.log('[EnvConfig] 🗑️ Clearing cache...');
      await AsyncStorage.removeItem('@env_config');
      this.config = null;
      this.initialized = false;
      console.log('[EnvConfig] ✅ Cache cleared');
    } catch (error) {
      console.error('[EnvConfig] ❌ Error clearing cache:', error);
    }
  }

  /**
   * Fuerza una recarga de la configuración
   */
  public async reload(): Promise<void> {
    console.log('[EnvConfig] 🔄 Forcing configuration reload...');
    this.initialized = false;
    this.config = null;
    await this.initialize();
  }

  /**
   * Limpia la caché
   */
  public async clearCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem('@env_config');
      console.log('[EnvConfig] 🗑️ Cache cleared');
    } catch (error) {
      console.warn('[EnvConfig] ⚠️ Error clearing cache:', error);
    }
  }
}

// Export singleton instance
export const envConfig = EnvConfigService.getInstance();

// Helper functions para compatibilidad
export const getEnv = (key: string): string | undefined => envConfig.get(key);
export const getEnvOrDefault = (key: string, defaultValue: string): string => envConfig.getOrDefault(key, defaultValue);
export const isEnvInitialized = (): boolean => envConfig.isInitialized();
