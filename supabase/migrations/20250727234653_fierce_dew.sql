-- Agregar columna push_token a la tabla profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Agregar columna notification_preferences a la tabla profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"push": true, "email": true}'::jsonb;

-- Crear índice para búsquedas rápidas por push_token
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token);

-- Comentarios para documentar las columnas
COMMENT ON COLUMN profiles.push_token IS 'Token de Expo Push Notifications para enviar notificaciones push';
COMMENT ON COLUMN profiles.notification_preferences IS 'Preferencias de notificaciones del usuario en formato JSON';