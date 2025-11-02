/*
  # Agregar Deep Links a Notificaciones de Pet Shares
  
  ## Cambios
  - Agregar URL de deep link en el campo `data` de las notificaciones
  - Incluir tanto el scheme personalizado (dogcatify://) como HTTPS
  - Agregar click_action para Android
  
  ## Deep Links
  - Scheme: dogcatify://pet-share/{shareId}
  - HTTPS: https://dogcatify.app/pet-share/{shareId}
  
  ## Notas
  - Los deep links permiten abrir la app directamente en la pantalla de invitación
  - Si el usuario no está autenticado, se le pedirá login primero
*/

-- Función actualizada con deep links
CREATE OR REPLACE FUNCTION notify_pet_share_created()
RETURNS TRIGGER AS $$
DECLARE
  pet_name text;
  owner_name text;
  deep_link_url text;
  https_link_url text;
BEGIN
  -- Obtener nombre de la mascota
  SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;

  -- Obtener nombre del dueño
  SELECT display_name INTO owner_name FROM profiles WHERE id = NEW.owner_id;

  -- Construir deep links
  deep_link_url := 'dogcatify://pet-share/' || NEW.id;
  https_link_url := 'https://dogcatify.app/pet-share/' || NEW.id;

  -- Crear notificación inmediata con deep links
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
    'pet_share_invitation',
    NEW.id,
    'pet_share',
    '¡Nueva mascota compartida!',
    owner_name || ' ha compartido a ' || pet_name || ' contigo',
    jsonb_build_object(
      'type', 'pet_share_invitation',
      'petId', NEW.pet_id,
      'shareId', NEW.id,
      'ownerId', NEW.owner_id,
      'relationshipType', NEW.relationship_type,
      'screen', 'PetShare',
      'url', deep_link_url,
      'link', https_link_url,
      'deepLink', deep_link_url,
      'click_action', 'OPEN_PET_SHARE_INVITATION'
    ),
    now(),
    'pending'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función actualizada para notificar aceptación (también con deep link)
CREATE OR REPLACE FUNCTION notify_pet_share_accepted()
RETURNS TRIGGER AS $$
DECLARE
  pet_name text;
  shared_user_name text;
  deep_link_url text;
  https_link_url text;
BEGIN
  -- Solo notificar si cambió a accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Obtener nombre de la mascota
    SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;

    -- Obtener nombre del usuario que aceptó
    SELECT display_name INTO shared_user_name FROM profiles WHERE id = NEW.shared_with_user_id;

    -- Construir deep links (en este caso, a los detalles de la mascota)
    deep_link_url := 'dogcatify://pets/' || NEW.pet_id;
    https_link_url := 'https://dogcatify.app/pets/' || NEW.pet_id;

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
      'pet_share_accepted',
      NEW.id,
      'pet_share',
      'Invitación aceptada',
      shared_user_name || ' ahora puede ver y gestionar a ' || pet_name,
      jsonb_build_object(
        'type', 'pet_share_accepted',
        'petId', NEW.pet_id,
        'shareId', NEW.id,
        'sharedUserId', NEW.shared_with_user_id,
        'screen', 'PetDetails',
        'url', deep_link_url,
        'link', https_link_url,
        'deepLink', deep_link_url,
        'click_action', 'OPEN_PET_DETAILS'
      ),
      now(),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios
COMMENT ON FUNCTION notify_pet_share_created() IS 
  'Crea notificación con deep link cuando se comparte una mascota';
COMMENT ON FUNCTION notify_pet_share_accepted() IS 
  'Crea notificación con deep link cuando se acepta una invitación';
