/*
  # Agregar tipo de notificación broadcast

  ## Cambios
  - Modifica el constraint de notification_type para incluir 'broadcast'
  - Modifica el constraint de reference_type para incluir 'broadcast'

  ## Propósito
  Permitir que el administrador envíe notificaciones masivas a todos los usuarios
  a través del sistema de notificaciones programadas existente.
*/

-- Eliminar el constraint existente de notification_type
ALTER TABLE scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;

-- Agregar el nuevo constraint incluyendo 'broadcast'
ALTER TABLE scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_notification_type_check
  CHECK (notification_type IN ('booking_reminder', 'order_status_change', 'broadcast'));

-- Eliminar el constraint existente de reference_type
ALTER TABLE scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_reference_type_check;

-- Agregar el nuevo constraint incluyendo 'broadcast'
ALTER TABLE scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_reference_type_check
  CHECK (reference_type IN ('booking', 'order', 'broadcast'));
