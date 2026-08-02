/**
 * Simple console logger replacement for DataDog
 * All DataDog functionality has been removed
 */

interface LogContext {
  [key: string]: any;
}

class SimpleLogger {
  async initialize() {
  }

  debug(message: string, context?: LogContext) {
  }

  info(message: string, context?: LogContext) {
  }

  warn(message: string, context?: LogContext) {
  }

  error(message: string, error?: Error, context?: LogContext) {
  }

  trackError(error: Error, source?: string, context?: LogContext) {
  }

  setUser(userId: string, userInfo?: Record<string, any>) {
  }

  clearUser() {
  }

  addAttribute(key: string, value: any) {
  }
}

export const logger = new SimpleLogger();
