/*
  # Arreglar RLS para Notificaciones de Compartir Mascotas

  ## Cambios
  - Agregar SECURITY DEFINER a las funciones para que puedan insertar en scheduled_notifications
  - Las funciones se ejecutarán con los privilegios del creador (superusuario)
  
  ## Notas
  - Sin SECURITY DEFINER, las funciones no pueden insertar debido a RLS
  - Esto es necesario para triggers que insertan en tablas con RLS
*/

-- Función corregida con SECURITY DEFINER
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
    'order_status_change',
    NEW.id,
    'order',
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

-- Función corregida con SECURITY DEFINER
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
      'order_status_change',
      NEW.id,
      'order',
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
      now(),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;