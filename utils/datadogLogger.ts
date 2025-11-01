import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DATADOG_CLIENT_TOKEN = Constants.expoConfig?.extra?.DATADOG_CLIENT_TOKEN ||
  process.env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN;
const DATADOG_APPLICATION_ID = Constants.expoConfig?.extra?.DATADOG_APPLICATION_ID ||
  process.env.EXPO_PUBLIC_DATADOG_APPLICATION_ID;
const DATADOG_ENV = Constants.expoConfig?.extra?.DATADOG_ENV ||
  process.env.EXPO_PUBLIC_DATADOG_ENV || 'production';
const DATADOG_SITE = Constants.expoConfig?.extra?.DATADOG_SITE ||
  process.env.EXPO_PUBLIC_DATADOG_SITE || 'US5';

// Dynamic import for DataDog SDK (only on native platforms)
let DdSdkReactNative: any;
let DdSdkReactNativeConfiguration: any;
let DdLogs: any;
let ErrorSource: any;
let UploadFrequency: any;

if (Platform.OS !== 'web') {
  try {
    const DatadogSDK = require('@datadog/mobile-react-native');
    DdSdkReactNative = DatadogSDK.DdSdkReactNative;
    DdSdkReactNativeConfiguration = DatadogSDK.DdSdkReactNativeConfiguration;
    DdLogs = DatadogSDK.DdLogs;
    ErrorSource = DatadogSDK.ErrorSource;
    UploadFrequency = DatadogSDK.UploadFrequency;
  } catch (error) {
    console.warn('DataDog SDK not available:', error);
  }
}

class DataDogLogger {
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      return;
    }

    if (Platform.OS === 'web') {
      console.log('DataDog is not available on web platform');
      return;
    }

    if (!DdSdkReactNative || !DdSdkReactNativeConfiguration) {
      console.log('DataDog SDK not loaded');
      return;
    }

    if (!DATADOG_CLIENT_TOKEN || !DATADOG_APPLICATION_ID) {
      console.warn('DataDog configuration is missing. Logs will only be displayed in console.');
      return;
    }

    try {
      const config = new DdSdkReactNativeConfiguration(
        DATADOG_CLIENT_TOKEN,
        DATADOG_ENV,
        DATADOG_APPLICATION_ID,
        true,
        true,
        true
      );

      config.site = DATADOG_SITE;
      config.uploadFrequency = UploadFrequency.FREQUENT;
      config.batchSize = 'SMALL';
      config.trackInteractions = true;
      config.trackResources = true;
      config.trackErrors = true;
      config.trackFrustrations = true;
      config.trackBackgroundEvents = true;

      await DdSdkReactNative.initialize(config);
      this.initialized = true;

      console.log('✅ DataDog initialized successfully');
    } catch (error) {
      // Silently fail - DataDog requires native build (not available in Expo Go)
      console.log('ℹ️ DataDog not available in this environment. Logs will be shown in console only.');
    }
  }

  debug(message: string, context?: Record<string, any>) {
    if (Platform.OS === 'web' || !DdLogs) {
      console.debug(message, context);
      return;
    }

    if (!this.initialized) {
      console.debug(message, context);
      return;
    }

    try {
      DdLogs.debug(message, context);
    } catch (error) {
      console.debug(message, context);
    }
  }

  info(message: string, context?: Record<string, any>) {
    if (Platform.OS === 'web' || !DdLogs) {
      console.info(message, context);
      return;
    }

    if (!this.initialized) {
      console.info(message, context);
      return;
    }

    try {
      DdLogs.info(message, context);
    } catch (error) {
      console.info(message, context);
    }
  }

  warn(message: string, context?: Record<string, any>) {
    if (Platform.OS === 'web' || !DdLogs) {
      console.warn(message, context);
      return;
    }

    if (!this.initialized) {
      console.warn(message, context);
      return;
    }

    try {
      DdLogs.warn(message, context);
    } catch (error) {
      console.warn(message, context);
    }
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    if (Platform.OS === 'web' || !DdLogs) {
      console.error(message, error, context);
      return;
    }

    if (!this.initialized) {
      console.error(message, error, context);
      return;
    }

    try {
      const errorInfo = {
        ...context,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorName: error?.name,
      };
      DdLogs.error(message, errorInfo);
    } catch (err) {
      console.error(message, error, context);
    }
  }

  setUser(userId: string, userInfo?: Record<string, any>) {
    if (Platform.OS === 'web' || !this.initialized || !DdSdkReactNative) {
      return;
    }

    try {
      DdSdkReactNative.setUser({
        id: userId,
        ...userInfo,
      });
    } catch (error) {
      console.error('Failed to set DataDog user:', error);
    }
  }

  clearUser() {
    if (Platform.OS === 'web' || !this.initialized || !DdSdkReactNative) {
      return;
    }

    try {
      DdSdkReactNative.setUser({});
    } catch (error) {
      console.error('Failed to clear DataDog user:', error);
    }
  }

  addAttribute(key: string, value: any) {
    if (Platform.OS === 'web' || !this.initialized || !DdSdkReactNative) {
      return;
    }

    try {
      DdSdkReactNative.setAttributes({
        [key]: value,
      });
    } catch (error) {
      console.error('Failed to add DataDog attribute:', error);
    }
  }

  trackError(error: Error, source: string, context?: Record<string, any>) {
    if (Platform.OS === 'web' || !DdSdkReactNative) {
      console.error(`[${source}]`, error, context);
      return;
    }

    if (!this.initialized) {
      console.error(`[${source}]`, error, context);
      return;
    }

    try {
      DdSdkReactNative.addError(
        error.message,
        ErrorSource.SOURCE,
        error.stack || '',
        {
          source,
          ...context,
        }
      );
    } catch (err) {
      console.error(`[${source}]`, error, context);
    }
  }
}

export const logger = new DataDogLogger();
