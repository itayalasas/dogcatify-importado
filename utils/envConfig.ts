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
  EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID: string;
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
      console.log('[EnvConfig] 🏗️ Execution environment:', Constants.executionEnvironment);

      // 1. Intentar cargar desde caché primero (más rápido)
      const cachedConfig = await this._loadFromCache();
      if (cachedConfig) {
        this.config = cachedConfig;
        console.log('[EnvConfig] 📦 Loaded from cache');
        this.initialized = true;
        return;
      }

      // 2. SIEMPRE intentar API Gateway primero si está configurado
      const apiGatewayConfig = Constants.expoConfig?.extra?.apiGateway;
      console.log('[EnvConfig] 🔍 API Gateway config:', {
        hasUrl: !!apiGatewayConfig?.url,
        hasApiKey: !!apiGatewayConfig?.apiKey,
        url: apiGatewayConfig?.url,
      });

      if (apiGatewayConfig?.url && apiGatewayConfig?.apiKey) {
        console.log('[EnvConfig] 🌐 API Gateway configured, loading from server...');
        try {
          const config = await this._fetchAndCacheConfig(apiGatewayConfig.url, apiGatewayConfig.apiKey);
          this.config = config;
          this.initialized = true;
          console.log('[EnvConfig] ✅ Configuration loaded from API Gateway');
          return;
        } catch (apiError: any) {
          console.error('[EnvConfig] ❌ Failed to load from API Gateway:', apiError.message);

          // Si el API Gateway falla, lanzar error inmediatamente
          // No usar process.env como fallback porque esto es producción
          throw new Error(
            'No se pudo cargar la configuración desde el servidor.\n' +
            'Verifica tu conexión a internet e intenta nuevamente.'
          );
        }
      }

      // 3. Si NO hay API Gateway configurado, intentar process.env (solo para desarrollo local)
      console.log('[EnvConfig] 🔧 No API Gateway configured, trying process.env (development mode)...');
      const envVars = this._loadFromProcessEnv();

      if (envVars) {
        this.config = envVars;
        this.initialized = true;
        await this._saveToCache(envVars);
        console.log('[EnvConfig] ✅ Configuration loaded from process.env (development)');
        return;
      }

      // 4. Si llegamos aquí, no hay configuración disponible
      throw new Error(
        'No se encontró configuración disponible.\n\n' +
        'Builds de producción: Asegúrate de que app.json tenga configurado el API Gateway.\n\n' +
        'Desarrollo local: Asegúrate de tener un archivo .env con las variables necesarias.'
      );

    } catch (error: any) {
      console.error('[EnvConfig] ❌ Failed to load configuration:', error);
      console.error('[EnvConfig] ❌ Error message:', error.message);

      // NO usar fallback - la app debe fallar claramente si no puede cargar configuración
      throw error;
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
          EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID: process.env.EXPO_PUBLIC_MERCADOPAGO_CLIENT_ID || '',
        };
      }
    } catch (error) {
      console.warn('[EnvConfig] ⚠️ Error loading from process.env:', error);
    }
    return null;
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
}

// Export singleton instance
export const envConfig = EnvConfigService.getInstance();

// Helper functions para compatibilidad
export const getEnv = (key: string): string | undefined => envConfig.get(key);
export const getEnvOrDefault = (key: string, defaultValue: string): string => envConfig.getOrDefault(key, defaultValue);
export const isEnvInitialized = (): boolean => envConfig.isInitialized();
