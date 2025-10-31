import { Platform } from 'react-native';
import {
  DdSdkReactNative,
  DdSdkReactNativeConfiguration,
  DdLogs,
  ErrorSource,
  LogLevel,
  UploadFrequency,
} from '@datadog/mobile-react-native';
import Constants from 'expo-constants';

const DATADOG_CLIENT_TOKEN = Constants.expoConfig?.extra?.DATADOG_CLIENT_TOKEN ||
  process.env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN;
const DATADOG_APPLICATION_ID = Constants.expoConfig?.extra?.DATADOG_APPLICATION_ID ||
  process.env.EXPO_PUBLIC_DATADOG_APPLICATION_ID;
const DATADOG_ENV = Constants.expoConfig?.extra?.DATADOG_ENV ||
  process.env.EXPO_PUBLIC_DATADOG_ENV || 'production';

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

    if (!DATADOG_CLIENT_TOKEN || !DATADOG_APPLICATION_ID) {
      console.error('DataDog configuration is missing');
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

      config.site = 'US1';
      config.uploadFrequency = UploadFrequency.FREQUENT;
      config.batchSize = 'SMALL';
      config.trackInteractions = true;
      config.trackResources = true;
      config.trackErrors = true;

      await DdSdkReactNative.initialize(config);
      this.initialized = true;

      this.info('DataDog initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DataDog:', error);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    if (Platform.OS === 'web') {
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
    if (Platform.OS === 'web') {
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
    if (Platform.OS === 'web') {
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
    if (Platform.OS === 'web') {
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
    if (Platform.OS === 'web' || !this.initialized) {
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
    if (Platform.OS === 'web' || !this.initialized) {
      return;
    }

    try {
      DdSdkReactNative.setUser({});
    } catch (error) {
      console.error('Failed to clear DataDog user:', error);
    }
  }

  addAttribute(key: string, value: any) {
    if (Platform.OS === 'web' || !this.initialized) {
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
    if (Platform.OS === 'web') {
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
