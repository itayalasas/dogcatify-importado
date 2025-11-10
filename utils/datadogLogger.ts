/**
 * Simple console logger replacement for DataDog
 * All DataDog functionality has been removed
 */

interface LogContext {
  [key: string]: any;
}

class SimpleLogger {
  async initialize() {
    console.log('[INFO] Simple logger initialized (DataDog removed)');
  }

  debug(message: string, context?: LogContext) {
    console.debug(message, context || '');
  }

  info(message: string, context?: LogContext) {
    console.info(message, context || '');
  }

  warn(message: string, context?: LogContext) {
    console.warn(message, context || '');
  }

  error(message: string, error?: Error, context?: LogContext) {
    console.error(message, error, context || '');
  }

  trackError(error: Error, source?: string, context?: LogContext) {
    console.error(`[${source || 'Unknown'}]`, error, context || '');
  }

  setUser(userId: string, userInfo?: Record<string, any>) {
    console.log('[INFO] User set:', userId, userInfo);
  }

  clearUser() {
    console.log('[INFO] User cleared');
  }

  addAttribute(key: string, value: any) {
    console.log('[INFO] Attribute added:', key, value);
  }
}

export const logger = new SimpleLogger();
