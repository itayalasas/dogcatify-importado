/*
  # Corregir política de admin para notificaciones broadcast

  ## Cambios
  - Elimina la política anterior que tenía error de permisos
  - Crea nueva política usando profiles en lugar de auth.users

  ## Propósito
  Permitir que el usuario admin pueda crear notificaciones masivas programadas
  usando la tabla profiles que sí es accesible
*/

-- Eliminar la política anterior
DROP POLICY IF EXISTS "Admin can insert broadcast notifications" ON scheduled_notifications;

-- Crear nueva política usando profiles
CREATE POLICY "Admin can insert broadcast notifications"
  ON scheduled_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = 'admin@dogcatify.com'
    )
    AND notification_type = 'broadcast'
  );
