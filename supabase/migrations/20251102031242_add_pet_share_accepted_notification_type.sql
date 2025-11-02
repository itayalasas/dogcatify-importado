/*
  # Agregar tipo de notificación para aceptación de compartir mascotas
  
  1. Cambios
    - Actualizar constraint de `notification_type` para incluir 'pet_share_accepted'
    - Esto permite notificar al dueño original cuando alguien acepta su invitación
  
  2. Tipos de notificación completos para pet sharing
    - 'pet_share_invitation' - Cuando alguien te comparte una mascota
    - 'pet_share_accepted' - Cuando alguien acepta tu invitación
  
  3. Notas
    - No afecta datos existentes
    - Solo expande los valores permitidos en el check constraint
*/

-- Eliminar constraint antiguo
ALTER TABLE scheduled_notifications 
  DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;

-- Crear nuevo constraint con todos los tipos de notificación
ALTER TABLE scheduled_notifications 
  ADD CONSTRAINT scheduled_notifications_notification_type_check 
  CHECK (notification_type IN (
    'booking_reminder', 
    'order_status_change', 
    'pet_share_invitation',
    'pet_share_accepted'
  ));
