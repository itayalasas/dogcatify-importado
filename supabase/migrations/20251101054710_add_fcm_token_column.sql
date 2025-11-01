/*
  # Agregar soporte para FCM API v1 tokens

  1. Cambios en la tabla profiles
    - Agregar columna `fcm_token` para almacenar tokens nativos de FCM
    - Mantener `push_token` existente para compatibilidad con Expo Push Service
    
  2. Índices
    - Crear índice en `fcm_token` para búsquedas rápidas
    
  3. Notas
    - `push_token`: Token de Expo Push Service (formato: ExponentPushToken[xxx])
    - `fcm_token`: Token nativo de FCM para Android (string largo ~150+ chars)
    - iOS seguirá usando APNs a través de Expo
    - Durante migración, ambos tokens coexistirán
*/

-- Agregar columna para FCM token nativo
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Crear índice para búsquedas rápidas por FCM token
CREATE INDEX IF NOT EXISTS idx_profiles_fcm_token
ON profiles(fcm_token)
WHERE fcm_token IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN profiles.push_token IS 'Expo Push Token (ExponentPushToken[xxx]) - usado para Expo Push Service (API heredada)';
COMMENT ON COLUMN profiles.fcm_token IS 'Firebase Cloud Messaging token nativo - usado para FCM API v1 en Android';
