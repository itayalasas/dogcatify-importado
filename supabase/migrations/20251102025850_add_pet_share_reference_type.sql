/*
  # Agregar tipo de referencia para compartir mascotas
  
  1. Cambios
    - Actualizar constraint de `reference_type` para incluir 'pet_share'
    - Esto permite que las notificaciones de compartir mascotas referencien correctamente
  
  2. Notas
    - No afecta datos existentes
    - Solo expande los valores permitidos en el check constraint
*/

-- Eliminar constraint antiguo
ALTER TABLE scheduled_notifications 
  DROP CONSTRAINT IF EXISTS scheduled_notifications_reference_type_check;

-- Crear nuevo constraint con los tipos actualizados
ALTER TABLE scheduled_notifications 
  ADD CONSTRAINT scheduled_notifications_reference_type_check 
  CHECK (reference_type IN ('booking', 'order', 'pet_share'));
