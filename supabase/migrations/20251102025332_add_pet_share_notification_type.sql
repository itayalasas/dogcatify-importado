/*
  # Agregar tipo de notificación para compartir mascotas
  
  1. Cambios
    - Actualizar constraint de `notification_type` para incluir 'pet_share_invitation'
    - Esto permite que el sistema de compartir mascotas cree notificaciones programadas
  
  2. Notas
    - No afecta datos existentes
    - Solo expande los valores permitidos en el check constraint
*/

-- Eliminar constraint antiguo
ALTER TABLE scheduled_notifications 
  DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;

-- Crear nuevo constraint con los tipos actualizados
ALTER TABLE scheduled_notifications 
  ADD CONSTRAINT scheduled_notifications_notification_type_check 
  CHECK (notification_type IN ('booking_reminder', 'order_status_change', 'pet_share_invitation'));
