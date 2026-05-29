/**
 * Servicio de Auditoría y Seguridad
 * 
 * Registra todas las acciones importantes del sistema en la tabla audit_logs
 * para propósitos de seguridad, debugging y compliance.
 */

import { supabaseClient } from '../lib/supabase';

/**
 * Tipos de acciones que se pueden registrar
 */
export type AuditAction =
  // Autenticación
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGIN_ERROR'
  | 'LOGIN_ATTEMPT'
  | 'LOGOUT'
  | 'PASSWORD_RESET'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_VERIFIED'
  
  // Recursos - Bookings
  | 'BOOKING_CREATE'
  | 'BOOKING_UPDATE'
  | 'BOOKING_CANCEL'
  | 'BOOKING_VIEW'
  
  // Recursos - Orders
  | 'ORDER_CREATE'
  | 'ORDER_UPDATE'
  | 'ORDER_CANCEL'
  | 'ORDER_VIEW'
  | 'ALBUM_CREATE'
  
  // Recursos - Payments
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_PENDING'
  
  // Recursos - Profile
  | 'PROFILE_CREATE'
  | 'PROFILE_UPDATE'
  | 'PROFILE_VIEW'
  
  // Recursos - Pets
  | 'PET_CREATE'
  | 'PET_UPDATE'
  | 'PET_DELETE'
  | 'PET_VIEW'
  
  // Recursos - Medical
  | 'MEDICAL_RECORD_CREATE'
  | 'MEDICAL_RECORD_UPDATE'
  | 'MEDICAL_RECORD_DELETE'
  | 'MEDICAL_RECORD_VIEW'
  
  // Administración
  | 'ADMIN_ACCESS'
  | 'ADMIN_DASHBOARD_VIEW'
  | 'SETTINGS_CHANGE'
  | 'SENSITIVE_DATA_VIEW'
  | 'EXPORT_DATA'
  | 'PARTNER_APPROVED'
  | 'PARTNER_REJECTED'
  | 'USER_BLOCKED'
  | 'USER_UNBLOCKED'
  
  // Sistema
  | 'ERROR'
  | 'API_ERROR'
  | 'SYSTEM_ERROR';

export type ResourceType = 'booking' | 'order' | 'payment' | 'profile' | 'pet' | 'medical_record' | 'partner' | 'user' | 'system' | 'album';

/**
 * Estructura del log de auditoría
 * Coincide con la estructura real de la tabla audit_logs en Supabase
 */
export interface AuditLog {
  user_id?: string;
  user_email?: string;
  action: AuditAction;
  resource_type?: ResourceType;
  resource_id?: string;
  success?: boolean;  // true = éxito, false = error
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  error_message?: string;
}

/**
 * Obtiene la IP del cliente desde múltiples fuentes
 */
const getClientIP = async (): Promise<string | undefined> => {
  try {
    // Intentar obtener IP pública del cliente
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (error) {
    console.warn('Could not fetch client IP:', error);
  }
  return undefined;
};

/**
 * Obtiene el User Agent del navegador/app
 */
const getUserAgent = (): string => {
  if (typeof navigator !== 'undefined') {
    return navigator.userAgent;
  }
  return 'Unknown';
};

/**
 * Obtiene información adicional del dispositivo/plataforma
 */
const getPlatformInfo = () => {
  const Platform = require('react-native').Platform;
  return {
    os: Platform.OS,
    version: Platform.Version,
    isTV: Platform.isTV || false,
    isTesting: Platform.isTesting || false
  };
};

/**
 * Registra una acción en el sistema de auditoría
 * 
 * @param action Tipo de acción realizada
 * @param options Opciones adicionales del log
 * 
 * @example
 * // Login exitoso
 * await logAction('LOGIN', {
 *   status: 'success',
 *   details: { method: 'email' }
 * });
 * 
 * @example
 * // Login fallido
 * await logAction('LOGIN_FAILED', {
 *   status: 'error',
 *   details: { email: 'user@example.com', reason: 'invalid_password' },
 *   error_message: 'Credenciales inválidas'
 * });
 */
export const logAction = async (
  action: AuditAction,
  options: Partial<AuditLog> = {}
): Promise<void> => {
  try {
    // Obtener usuario actual
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    // Si no tenemos user_id pero sí tenemos email en details, usarlo
    const userEmail = user?.email || options.user_email || options.details?.email;
    
    // Intentar obtener IP (async pero no bloqueamos)
    let ipAddress = options.ip_address;
    if (!ipAddress) {
      try {
        ipAddress = await getClientIP();
      } catch (error) {
        console.warn('Could not get IP:', error);
      }
    }
    
    // Enriquecer details con información de plataforma
    const platformInfo = getPlatformInfo();
    const enrichedDetails = {
      ...options.details,
      platform: platformInfo,
      timestamp: new Date().toISOString()
    };
    
    const logEntry: AuditLog = {
      user_id: user?.id,
      user_email: userEmail,
      action,
      success: options.success !== undefined ? options.success : true,
      resource_type: options.resource_type,
      resource_id: options.resource_id,
      ip_address: ipAddress,
      user_agent: options.user_agent || getUserAgent(),
      details: enrichedDetails,
      error_message: options.error_message
    };

    const { error } = await supabaseClient
      .from('audit_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Error al registrar log de auditoría:', error);
    }
  } catch (error) {
    // No lanzar error para no interrumpir el flujo principal
    console.error('Error en logAction:', error);
  }
};

/**
 * Registra un error en el sistema de auditoría
 * 
 * @param error Error a registrar
 * @param context Contexto adicional del error
 * 
 * @example
 * try {
 *   await createBooking(data);
 * } catch (error) {
 *   await logError(error, {
 *     resource_type: 'booking',
 *     resource_id: bookingId,
 *     details: { step: 'create', data }
 *   });
 * }
 */
export const logError = async (
  error: any,
  context: {
    action?: AuditAction;
    resource_type?: ResourceType;
    resource_id?: string;
    details?: Record<string, any>;
  } = {}
): Promise<void> => {
  const errorMessage = error?.message || String(error);
  
  await logAction(context.action || 'ERROR', {
    success: false,
    resource_type: context.resource_type,
    resource_id: context.resource_id,
    error_message: errorMessage,
    details: {
      ...context.details,
      error_stack: error?.stack,
      error_code: error?.code
    }
  });
};

/**
 * Registra una acción sobre un recurso específico
 * 
 * @param action Tipo de acción
 * @param resourceType Tipo de recurso
 * @param resourceId ID del recurso
 * @param options Opciones adicionales
 * 
 * @example
 * // Crear booking
 * await logResourceAction('BOOKING_CREATE', 'booking', bookingId, {
 *   status: 'success',
 *   details: {
 *     service_name: 'Paseo Premium',
 *     pet_name: 'Luna',
 *     date: '2026-02-10'
 *   }
 * });
 */
export const logResourceAction = async (
  action: AuditAction,
  resourceType: ResourceType,
  resourceId: string,
  options: Partial<AuditLog> = {}
): Promise<void> => {
  await logAction(action, {
    ...options,
    resource_type: resourceType,
    resource_id: resourceId
  });
};

/**
 * Registra un acceso a datos sensibles (para compliance)
 * 
 * @param resourceType Tipo de dato sensible
 * @param resourceId ID del recurso
 * @param reason Razón del acceso
 * 
 * @example
 * await logSensitiveAccess('profile', userId, 'Revisión de soporte');
 */
export const logSensitiveAccess = async (
  resourceType: ResourceType,
  resourceId: string,
  reason: string
): Promise<void> => {
  await logResourceAction('SENSITIVE_DATA_VIEW', resourceType, resourceId, {
    success: true,
    details: { reason }
  });
};

/**
 * Registra un cambio en la configuración del sistema
 * 
 * @param settingName Nombre de la configuración
 * @param oldValue Valor anterior
 * @param newValue Nuevo valor
 * 
 * @example
 * await logSettingChange('commission_rate', 5, 10);
 */
export const logSettingChange = async (
  settingName: string,
  oldValue: any,
  newValue: any
): Promise<void> => {
  await logAction('SETTINGS_CHANGE', {
    success: true,
    resource_type: 'system',
    resource_id: settingName,
    details: {
      setting: settingName,
      old_value: oldValue,
      new_value: newValue
    }
  });
};

/**
 * Hook para React: Auditar una acción al montar un componente
 * 
 * @example
 * const MyAdminPanel = () => {
 *   useAudit('ADMIN_DASHBOARD_VIEW');
 *   return <div>...</div>;
 * };
 */
export const useAudit = (action: AuditAction, details?: Record<string, any>) => {
  const [logged, setLogged] = React.useState(false);
  
  React.useEffect(() => {
    if (!logged) {
      logAction(action, { details });
      setLogged(true);
    }
  }, [action, details, logged]);
};

// Para evitar error de React not defined
import React from 'react';
