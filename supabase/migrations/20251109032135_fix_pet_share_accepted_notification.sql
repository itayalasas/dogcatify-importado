/*
  # Corregir notificación de aceptación de compartir mascota

  ## Descripción
  Arregla la función que envía notificación push cuando un usuario acepta una invitación
  para compartir una mascota. La función original tenía errores en los nombres de columnas.

  ## Cambios
  - Corregir `type` → `notification_type` y `reference_type`
  - Agregar campos faltantes: `reference_id`, `status`
  - Asegurar que la notificación se envíe inmediatamente
*/

-- Recrear función con columnas correctas
CREATE OR REPLACE FUNCTION notify_pet_share_accepted()
RETURNS TRIGGER AS $$
DECLARE
  pet_name_text text;
  shared_user_name_text text;
BEGIN
  -- Solo notificar si cambió de pending a accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Obtener nombre de la mascota
    SELECT name INTO pet_name_text FROM pets WHERE id = NEW.pet_id;
    
    -- Obtener nombre del usuario que aceptó
    SELECT display_name INTO shared_user_name_text 
    FROM profiles 
    WHERE id = NEW.shared_with_user_id;
    
    -- Usar email si no tiene display_name
    IF shared_user_name_text IS NULL OR shared_user_name_text = '' THEN
      SELECT email INTO shared_user_name_text
      FROM auth.users
      WHERE id = NEW.shared_with_user_id;
    END IF;
    
    -- Notificar al dueño que aceptaron su invitación
    INSERT INTO scheduled_notifications (
      user_id,
      notification_type,
      reference_id,
      reference_type,
      title,
      body,
      data,
      scheduled_for,
      status
    ) VALUES (
      NEW.owner_id,
      'pet_share_accepted',
      NEW.id,
      'pet_share',
      '✅ Invitación Aceptada',
      format('%s aceptó tu invitación para compartir a %s', 
        COALESCE(shared_user_name_text, 'Un usuario'),
        COALESCE(pet_name_text, 'tu mascota')
      ),
      jsonb_build_object(
        'share_id', NEW.id,
        'pet_id', NEW.pet_id,
        'pet_name', pet_name_text,
        'shared_user_id', NEW.shared_with_user_id,
        'shared_user_name', shared_user_name_text,
        'screen', 'PetDetails'
      ),
      now(), -- Enviar inmediatamente
      'pending'
    );
    
    RAISE NOTICE 'Notification created for pet share acceptance: % accepted by %', pet_name_text, shared_user_name_text;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Asegurar que el trigger existe
DROP TRIGGER IF EXISTS on_pet_share_status_changed ON pet_shares;
CREATE TRIGGER on_pet_share_status_changed
  AFTER UPDATE ON pet_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_pet_share_accepted();
