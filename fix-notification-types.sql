-- Paso 1: Eliminar el constraint existente
ALTER TABLE scheduled_notifications 
DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;

-- Paso 2: Recrear el constraint con TODOS los tipos de notificación
ALTER TABLE scheduled_notifications 
ADD CONSTRAINT scheduled_notifications_notification_type_check 
CHECK (notification_type IN (
  'booking_reminder',
  'order_status_change',
  'pet_share_request',
  'pet_share_accepted',
  'pet_share_invitation',
  'booking_confirmation',
  'vaccine_reminder_7days',
  'vaccine_reminder_24hours',
  'broadcast'
));

-- Paso 3: Verificar el constraint reference_type también
ALTER TABLE scheduled_notifications 
DROP CONSTRAINT IF EXISTS scheduled_notifications_reference_type_check;

ALTER TABLE scheduled_notifications 
ADD CONSTRAINT scheduled_notifications_reference_type_check 
CHECK (reference_type IN ('booking', 'order', 'pet_share', 'pet_health', 'broadcast'));

-- Paso 4: Eliminar el índice anterior si existe
DROP INDEX IF EXISTS idx_unique_vaccine_reminder;

-- Paso 5: Crear el índice único correcto
CREATE UNIQUE INDEX idx_unique_vaccine_reminder 
  ON scheduled_notifications(reference_id, notification_type, status)
  WHERE notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours');

-- Verificar los cambios
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'scheduled_notifications'::regclass
  AND conname LIKE '%notification_type%';
