-- Rescue migration: ensure pet match notifications triggers exist and constraints allow new notification types

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_reference_type_check;

ALTER TABLE public.scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_notification_type_check
  CHECK (
    notification_type = ANY (
      ARRAY[
        'booking_reminder'::text,
        'order_status_change'::text,
        'pet_share_request'::text,
        'pet_share_accepted'::text,
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

ALTER TABLE public.scheduled_notifications
  ADD CONSTRAINT scheduled_notifications_reference_type_check
  CHECK (
    reference_type = ANY (
      ARRAY[
        'booking'::text,
        'order'::text,
        'pet_share'::text,
        'pet_health'::text,
        'broadcast'::text,
        'pet_match'::text,
        'pet_match_message'::text
      ]
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.create_pet_match_notifications() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pet_a_name text;
  pet_b_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.matched_at IS NOT DISTINCT FROM NEW.matched_at THEN
    RETURN NEW;
  END IF;

  SELECT name INTO pet_a_name FROM public.pets WHERE id = NEW.pet_a_id;
  SELECT name INTO pet_b_name FROM public.pets WHERE id = NEW.pet_b_id;

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
    v.user_id,
    'pet_match_created',
    NEW.id,
    'pet_match',
    '¡Nuevo match! 🎉',
    v.body,
    v.data,
    now(),
    'pending'
  FROM (
    VALUES
      (
        NEW.owner_a_id,
        format('%s hizo match con %s. ¡Empieza a chatear!', COALESCE(pet_a_name, 'Tu mascota'), COALESCE(pet_b_name, 'otra mascota')),
        jsonb_build_object(
          'screen', 'PetMatching',
          'match_id', NEW.id,
          'pet_id', NEW.pet_a_id,
          'other_pet_id', NEW.pet_b_id
        )
      ),
      (
        NEW.owner_b_id,
        format('%s hizo match con %s. ¡Empieza a chatear!', COALESCE(pet_b_name, 'Tu mascota'), COALESCE(pet_a_name, 'otra mascota')),
        jsonb_build_object(
          'screen', 'PetMatching',
          'match_id', NEW.id,
          'pet_id', NEW.pet_b_id,
          'other_pet_id', NEW.pet_a_id
        )
      )
  ) AS v(user_id, body, data)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.scheduled_notifications sn
    WHERE sn.user_id = v.user_id
      AND sn.notification_type = 'pet_match_created'
      AND sn.reference_id = NEW.id
      AND sn.reference_type = 'pet_match'
      AND sn.status IN ('pending', 'sent', 'failed')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_pet_match_notifications ON public.pet_matches;
CREATE TRIGGER trigger_create_pet_match_notifications
AFTER INSERT OR UPDATE ON public.pet_matches
FOR EACH ROW
EXECUTE FUNCTION public.create_pet_match_notifications();

CREATE OR REPLACE FUNCTION public.create_pet_match_message_notification() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  sender_pet_name text;
  chat_match_id uuid;
  message_preview text;
BEGIN
  SELECT
    c.match_id,
    CASE
      WHEN c.owner_a_id = NEW.sender_id THEN c.owner_b_id
      WHEN c.owner_b_id = NEW.sender_id THEN c.owner_a_id
      ELSE NULL
    END
  INTO chat_match_id, recipient_id
  FROM public.pet_match_chats c
  WHERE c.id = NEW.chat_id;

  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT p.name
  INTO sender_pet_name
  FROM public.pet_matches pm
  JOIN public.pets p
    ON p.id = CASE WHEN pm.owner_a_id = NEW.sender_id THEN pm.pet_a_id ELSE pm.pet_b_id END
  WHERE pm.id = chat_match_id;

  message_preview := left(COALESCE(NEW.message, ''), 120);

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
    recipient_id,
    'pet_match_message',
    NEW.id,
    'pet_match_message',
    'Nuevo mensaje en tu match',
    format('%s: %s', COALESCE(sender_pet_name, 'Tu match'), message_preview),
    jsonb_build_object(
      'screen', 'PetMatchChat',
      'chat_id', NEW.chat_id,
      'match_id', chat_match_id,
      'message_id', NEW.id
    ),
    now(),
    'pending'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.scheduled_notifications sn
    WHERE sn.user_id = recipient_id
      AND sn.notification_type = 'pet_match_message'
      AND sn.reference_id = NEW.id
      AND sn.reference_type = 'pet_match_message'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_pet_match_message_notification ON public.pet_match_messages;
CREATE TRIGGER trigger_create_pet_match_message_notification
AFTER INSERT ON public.pet_match_messages
FOR EACH ROW
EXECUTE FUNCTION public.create_pet_match_message_notification();
