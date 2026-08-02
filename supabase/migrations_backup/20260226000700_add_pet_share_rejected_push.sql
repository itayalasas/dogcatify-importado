-- Add push notification when a pet share invitation is rejected

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;

ALTER TABLE public.scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_notification_type_check
  CHECK (
    notification_type = ANY (
      ARRAY[
        'booking_reminder'::text,
        'order_status_change'::text,
        'pet_share_request'::text,
        'pet_share_accepted'::text,
        'pet_share_rejected'::text,
        'pet_share_invitation'::text,
        'booking_confirmation'::text,
        'vaccine_reminder_7days'::text,
        'vaccine_reminder_24hours'::text,
        'broadcast'::text,
        'pet_match_created'::text,
        'pet_match_message'::text
      ]
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.notify_pet_share_accepted() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pet_name_text text;
  shared_user_name_text text;
  target_notification_type text;
  target_title text;
  target_body text;
BEGIN
  IF OLD.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('accepted', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO pet_name_text
  FROM public.pets p
  WHERE p.id = NEW.pet_id;

  SELECT pr.display_name INTO shared_user_name_text
  FROM public.profiles pr
  WHERE pr.id = NEW.shared_with_user_id;

  IF shared_user_name_text IS NULL OR shared_user_name_text = '' THEN
    SELECT u.email INTO shared_user_name_text
    FROM auth.users u
    WHERE u.id = NEW.shared_with_user_id;
  END IF;

  IF NEW.status = 'accepted' THEN
    target_notification_type := 'pet_share_accepted';
    target_title := '✅ Invitación Aceptada';
    target_body := format('%s aceptó tu invitación para compartir a %s',
      COALESCE(shared_user_name_text, 'Un usuario'),
      COALESCE(pet_name_text, 'tu mascota')
    );
  ELSE
    target_notification_type := 'pet_share_rejected';
    target_title := '❌ Invitación Rechazada';
    target_body := format('%s rechazó tu invitación para compartir a %s',
      COALESCE(shared_user_name_text, 'Un usuario'),
      COALESCE(pet_name_text, 'tu mascota')
    );
  END IF;

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
    NEW.owner_id,
    target_notification_type,
    NEW.id,
    'pet_share',
    target_title,
    target_body,
    jsonb_build_object(
      'share_id', NEW.id,
      'pet_id', NEW.pet_id,
      'pet_name', pet_name_text,
      'shared_user_id', NEW.shared_with_user_id,
      'shared_user_name', shared_user_name_text,
      'status', NEW.status,
      'screen', 'PetDetails'
    ),
    now(),
    'pending'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.scheduled_notifications sn
    WHERE sn.user_id = NEW.owner_id
      AND sn.notification_type = target_notification_type
      AND sn.reference_id = NEW.id
      AND sn.reference_type = 'pet_share'
      AND sn.status IN ('pending', 'sent', 'failed')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pet_share_status_changed ON public.pet_shares;
CREATE TRIGGER on_pet_share_status_changed
AFTER UPDATE ON public.pet_shares
FOR EACH ROW
EXECUTE FUNCTION public.notify_pet_share_accepted();
