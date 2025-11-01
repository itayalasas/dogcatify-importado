/*
  # Arreglar Tipo de Notificación en Pet Shares
  
  ## Problema Identificado
  Las notificaciones de compartir mascotas están usando:
  - notification_type: 'order_status_change' (incorrecto)
  - reference_type: 'order' (incorrecto)
  
  Esto puede causar confusión y problemas al procesar notificaciones.
  
  ## Solución
  - Cambiar notification_type a tipo específico de pet shares
  - Cambiar reference_type a 'pet_share'
  - Mantener SECURITY DEFINER para que funcionen los triggers
  
  ## Notas
  - Esta corrección mejora la claridad y facilita el debugging
  - No afecta el envío de notificaciones, solo la organización
*/

-- Función corregida con tipos apropiados
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

  -- Crear notificación inmediata
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
    'pet_share_invitation',  -- Tipo correcto
    NEW.id,
    'pet_share',  -- Reference type correcto
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
    now(),
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función corregida para notificar aceptación
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
      'pet_share_accepted',  -- Tipo correcto
      NEW.id,
      'pet_share',  -- Reference type correcto
      'Invitación aceptada',
      shared_user_name || ' ahora puede ver y gestionar a ' || pet_name,
      jsonb_build_object(
        'type', 'pet_share_accepted',
        'petId', NEW.pet_id,
        'shareId', NEW.id,
        'sharedUserId', NEW.shared_with_user_id,
        'screen', 'PetDetails'
      ),
      now(),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentario explicativo
COMMENT ON FUNCTION notify_pet_share_created() IS 'Crea notificación cuando se comparte una mascota';
COMMENT ON FUNCTION notify_pet_share_accepted() IS 'Crea notificación cuando se acepta una invitación de compartir mascota';
