-- Ensure push notification is created when a pet is shared (invitation pending)

CREATE OR REPLACE FUNCTION public.notify_pet_share_created() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pet_name text;
  owner_name text;
  deep_link_url text;
  https_link_url text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO pet_name FROM public.pets p WHERE p.id = NEW.pet_id;

  SELECT pr.display_name INTO owner_name
  FROM public.profiles pr
  WHERE pr.id = NEW.owner_id;

  IF owner_name IS NULL OR owner_name = '' THEN
    SELECT u.email INTO owner_name
    FROM auth.users u
    WHERE u.id = NEW.owner_id;
  END IF;

  deep_link_url := 'dogcatify://pet-share/' || NEW.id;
  https_link_url := 'https://dogcatify.app/pet-share/' || NEW.id;

  INSERT INTO public.scheduled_notifications (
    user_id,
    notification_type,
    reference_id,
    reference_type,
    title,
    body,
    data,
    scheduled_for,
    status
  )
  SELECT
    NEW.shared_with_user_id,
    'pet_share_invitation',
    NEW.id,
    'pet_share',
    format('🐾 %s fue compartido contigo', COALESCE(pet_name, 'Una mascota')),
    format('%s compartió a %s contigo. Debes aceptar la invitación para ver su información.', COALESCE(owner_name, 'Un usuario'), COALESCE(pet_name, 'esta mascota')),
    jsonb_build_object(
      'type', 'pet_share_invitation',
      'petId', NEW.pet_id,
      'petName', pet_name,
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
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.scheduled_notifications sn
    WHERE sn.user_id = NEW.shared_with_user_id
      AND sn.notification_type = 'pet_share_invitation'
      AND sn.reference_id = NEW.id
      AND sn.reference_type = 'pet_share'
      AND sn.status IN ('pending', 'sent', 'failed')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pet_share_created ON public.pet_shares;
CREATE TRIGGER on_pet_share_created
AFTER INSERT ON public.pet_shares
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION public.notify_pet_share_created();
