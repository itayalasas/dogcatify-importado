/*
  # Arreglar Notificaciones de Compartir Mascotas

  ## Cambios
  - Corregir funciones de notificación para usar las columnas correctas de scheduled_notifications
  - Cambiar 'type' por 'notification_type' y 'reference_type'
  - Agregar los campos obligatorios que faltaban

  ## Notas
  - La tabla scheduled_notifications tiene:
    - notification_type (booking_reminder, order_status_change, etc.)
    - reference_id y reference_type
  - NO tiene columna 'type' simple
*/

-- Función corregida para notificar cuando se crea un compartir
CREATE OR REPLACE FUNCTION notify_pet_share_created()
RETURNS TRIGGER AS $$
DECLARE
  pet_name text;
  owner_name text;
BEGIN
  -- Obtener nombre de la mascota
  SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;

  -- Obtener nombre del dueño
  SELECT display_name INTO owner_name FROM profiles WHERE id = NEW.owner_id;

  -- Crear notificación inmediata (no programada)
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
    NEW.shared_with_user_id,
    'order_status_change', -- Usar tipo existente, luego cambiaremos en el data
    NEW.id,
    'order', -- Usar tipo existente, el data.type tendrá el valor real
    '¡Nueva mascota compartida!',
    owner_name || ' ha compartido a ' || pet_name || ' contigo',
    jsonb_build_object(
      'type', 'pet_share_invitation',
      'petId', NEW.pet_id,
      'shareId', NEW.id,
      'ownerId', NEW.owner_id,
      'relationshipType', NEW.relationship_type,
      'screen', 'PetShares'
    ),
    now(), -- Enviar inmediatamente
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función corregida para notificar cuando se acepta una invitación
CREATE OR REPLACE FUNCTION notify_pet_share_accepted()
RETURNS TRIGGER AS $$
DECLARE
  pet_name text;
  shared_user_name text;
BEGIN
  -- Solo notificar si cambió a accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Obtener nombre de la mascota
    SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;

    -- Obtener nombre del usuario que aceptó
    SELECT display_name INTO shared_user_name FROM profiles WHERE id = NEW.shared_with_user_id;

    -- Notificar al dueño
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
      'order_status_change', -- Usar tipo existente
      NEW.id,
      'order', -- Usar tipo existente
      'Invitación aceptada',
      shared_user_name || ' ahora puede ver y gestionar a ' || pet_name,
      jsonb_build_object(
        'type', 'pet_share_accepted',
        'petId', NEW.pet_id,
        'shareId', NEW.id,
        'sharedUserId', NEW.shared_with_user_id,
        'screen', 'PetDetails',
        'petId', NEW.pet_id
      ),
      now(), -- Enviar inmediatamente
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear los triggers con las funciones corregidas
DROP TRIGGER IF EXISTS on_pet_share_created ON pet_shares;
CREATE TRIGGER on_pet_share_created
  AFTER INSERT ON pet_shares
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_pet_share_created();

DROP TRIGGER IF EXISTS on_pet_share_status_changed ON pet_shares;
CREATE TRIGGER on_pet_share_status_changed
  AFTER UPDATE ON pet_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_pet_share_accepted();
