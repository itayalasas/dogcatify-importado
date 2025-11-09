/*
  # Permitir al admin insertar notificaciones broadcast

  ## Cambios
  - Agrega política RLS para permitir que el admin inserte notificaciones de tipo broadcast

  ## Propósito
  Permitir que el usuario admin pueda crear notificaciones masivas programadas
  sin necesidad de usar service_role
*/

-- Permitir al admin insertar notificaciones broadcast
CREATE POLICY "Admin can insert broadcast notifications"
  ON scheduled_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@dogcatify.com'
    AND notification_type = 'broadcast'
  );
