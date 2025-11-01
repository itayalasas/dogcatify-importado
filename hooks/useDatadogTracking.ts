import { useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'expo-router';
import { logger } from '@/utils/datadogLogger';
import { Platform } from 'react-native';

/**
 * Hook personalizado para tracking automático en Datadog
 *
 * Uso:
 *   const { trackAction, trackError, trackTiming } = useDatadogTracking('ScreenName');
 */
export function useDatadogTracking(screenName: string) {
  const pathname = usePathname();
  const mountTime = useRef(Date.now());
  const viewStartTime = useRef(Date.now());

  // Track page view cuando el componente se monta
  useEffect(() => {
    const viewId = `${screenName}_${Date.now()}`;

    logger.info('Screen View', {
      screen: screenName,
      path: pathname,
      viewId,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });

    logger.addAttribute('current_screen', screenName);
    logger.addAttribute('current_path', pathname);

    viewStartTime.current = Date.now();

    // Track cuando el usuario abandona la pantalla
    return () => {
      const timeOnScreen = Date.now() - viewStartTime.current;

      logger.info('Screen Exit', {
        screen: screenName,
        timeOnScreen,
        viewId,
      });
    };
  }, [screenName, pathname]);

  // Track user actions
  const trackAction = useCallback((
    action: string,
    properties?: Record<string, any>
  ) => {
    logger.info(`Action: ${action}`, {
      screen: screenName,
      action,
      ...properties,
      timestamp: new Date().toISOString(),
    });
  }, [screenName]);

  // Track errores específicos de la pantalla
  const trackError = useCallback((
    error: Error,
    context?: Record<string, any>
  ) => {
    logger.trackError(error, screenName, {
      ...context,
      path: pathname,
    });
  }, [screenName, pathname]);

  // Track timing de operaciones
  const trackTiming = useCallback((
    operationName: string,
    durationMs: number,
    properties?: Record<string, any>
  ) => {
    logger.info(`Timing: ${operationName}`, {
      screen: screenName,
      operation: operationName,
      duration: durationMs,
      ...properties,
    });
  }, [screenName]);

  // Track API calls
  const trackApiCall = useCallback((
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number,
    error?: Error
  ) => {
    const logData = {
      screen: screenName,
      endpoint,
      method,
      statusCode,
      duration: durationMs,
      success: statusCode >= 200 && statusCode < 300,
    };

    if (error) {
      logger.error(`API Error: ${endpoint}`, error, logData);
    } else {
      logger.info(`API Call: ${endpoint}`, logData);
    }
  }, [screenName]);

  // Track user interactions
  const trackInteraction = useCallback((
    elementName: string,
    interactionType: 'tap' | 'long_press' | 'swipe' | 'scroll',
    properties?: Record<string, any>
  ) => {
    logger.info('User Interaction', {
      screen: screenName,
      element: elementName,
      interactionType,
      ...properties,
    });
  }, [screenName]);

  return {
    trackAction,
    trackError,
    trackTiming,
    trackApiCall,
    trackInteraction,
  };
}

/**
 * Hook para tracking de performance de componentes
 */
export function usePerformanceTracking(componentName: string) {
  const renderCount = useRef(0);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;

    const renderTime = Date.now() - mountTime.current;

    if (renderCount.current === 1) {
      // Primer render
      logger.info('Component Mount', {
        component: componentName,
        mountTime: renderTime,
      });
    } else {
      // Re-renders subsecuentes
      logger.debug('Component Re-render', {
        component: componentName,
        renderCount: renderCount.current,
      });
    }

    return () => {
      if (renderCount.current === 1) {
        const totalLifeTime = Date.now() - mountTime.current;
        logger.info('Component Unmount', {
          component: componentName,
          lifeTime: totalLifeTime,
          renderCount: renderCount.current,
        });
      }
    };
  });

  return {
    renderCount: renderCount.current,
  };
}

/**
 * Hook para tracking de formularios
 */
export function useFormTracking(formName: string) {
  const startTime = useRef(Date.now());
  const fieldInteractions = useRef<Record<string, number>>({});

  useEffect(() => {
    logger.info('Form Started', {
      form: formName,
    });

    return () => {
      const timeSpent = Date.now() - startTime.current;
      logger.info('Form Abandoned', {
        form: formName,
        timeSpent,
        fieldInteractions: Object.keys(fieldInteractions.current).length,
      });
    };
  }, [formName]);

  const trackFieldInteraction = useCallback((fieldName: string) => {
    if (!fieldInteractions.current[fieldName]) {
      fieldInteractions.current[fieldName] = 0;
    }
    fieldInteractions.current[fieldName]++;

    logger.debug('Form Field Interaction', {
      form: formName,
      field: fieldName,
      interactions: fieldInteractions.current[fieldName],
    });
  }, [formName]);

  const trackFieldError = useCallback((fieldName: string, errorMessage: string) => {
    logger.warn('Form Field Error', {
      form: formName,
      field: fieldName,
      error: errorMessage,
    });
  }, [formName]);

  const trackSubmit = useCallback((success: boolean, error?: Error) => {
    const timeToSubmit = Date.now() - startTime.current;

    if (success) {
      logger.info('Form Submitted', {
        form: formName,
        timeToSubmit,
        fieldInteractions: fieldInteractions.current,
      });
    } else {
      logger.error('Form Submission Failed', error, {
        form: formName,
        timeToSubmit,
      });
    }
  }, [formName]);

  return {
    trackFieldInteraction,
    trackFieldError,
    trackSubmit,
  };
}
