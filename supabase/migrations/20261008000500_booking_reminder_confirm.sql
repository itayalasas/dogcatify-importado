-- Recordatorio push 24 h antes de un turno (veterinaria, peluquería, paseos)
-- con botones Confirmar / Cancelar, aunque el turno ya esté pagado.
--
-- 1. Columnas de respuesta del cliente en bookings.
-- 2. booking_appointment_at(): fecha y hora real del turno.
-- 3. create_booking_reminder_notification(): ahora agenda el recordatorio
--    cuando el turno queda confirmado (pago aprobado o reserva gratuita),
--    a la hora real del turno, solo para veterinaria, peluquería y paseos.
--    Si cambia la fecha se reprograma; si se cancela, se anula.
-- 4. Backfill para los turnos futuros que ya existen.
-- 5. respond_booking_reminder(): lo llama la app al tocar Confirmar o
--    Cancelar. Avisa al negocio por push.
-- 6. Tipos nuevos de notificación y envío inmediato de los avisos al negocio.

-- 1 ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_cancelled_at timestamptz;

-- 2 ---------------------------------------------------------------------------
-- `date` llega de dos formas: medianoche UTC con la hora aparte en `time`
-- (reserva paga) o la fecha y hora local ya armadas (reserva gratuita).
CREATE OR REPLACE FUNCTION public.booking_appointment_at(p_date timestamptz, p_time text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_day date;
BEGIN
  IF p_date IS NULL THEN
    RETURN NULL;
  END IF;

  IF (p_date AT TIME ZONE 'UTC')::time = time '00:00' THEN
    v_day := (p_date AT TIME ZONE 'UTC')::date;
  ELSE
    v_day := (p_date AT TIME ZONE 'America/Montevideo')::date;
  END IF;

  IF p_time ~ '^\d{1,2}:\d{2}' THEN
    RETURN (v_day + substring(p_time from '^\d{1,2}:\d{2}')::time) AT TIME ZONE 'America/Montevideo';
  END IF;

  -- Sin hora: se toma el mediodía para que el aviso llegue el día anterior.
  RETURN (v_day + time '12:00') AT TIME ZONE 'America/Montevideo';
END;
$$;

-- 3 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_reminder_notification() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_type text;
  v_appointment timestamptz;
  v_reminder timestamptz;
  v_active boolean;
  v_when text;
BEGIN
  IF NEW.status = 'cancelled' THEN
    UPDATE scheduled_notifications
       SET status = 'cancelled', updated_at = now()
     WHERE reference_id = NEW.id
       AND reference_type = 'booking'
       AND notification_type = 'booking_reminder'
       AND status = 'pending';
    RETURN NEW;
  END IF;

  v_active := NEW.status = 'confirmed' OR NEW.payment_status = 'approved';
  IF NOT v_active OR NEW.customer_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Solo hace falta reprogramar si es nuevo, recién confirmado o cambió la fecha.
  IF TG_OP = 'UPDATE'
     AND (OLD.status = 'confirmed' OR OLD.payment_status = 'approved')
     AND OLD.date IS NOT DISTINCT FROM NEW.date
     AND OLD.time IS NOT DISTINCT FROM NEW.time THEN
    RETURN NEW;
  END IF;

  SELECT business_type INTO v_business_type FROM partners WHERE id = NEW.partner_id;
  IF v_business_type IS NULL OR v_business_type NOT IN ('veterinary', 'grooming', 'walking') THEN
    RETURN NEW;
  END IF;

  v_appointment := public.booking_appointment_at(NEW.date, NEW.time);
  v_reminder := v_appointment - interval '24 hours';

  -- Reservas hechas con menos de 24 h: no se pide confirmación.
  IF v_appointment IS NULL OR v_reminder <= now() THEN
    RETURN NEW;
  END IF;

  DELETE FROM scheduled_notifications
   WHERE reference_id = NEW.id
     AND reference_type = 'booking'
     AND notification_type = 'booking_reminder'
     AND status = 'pending';

  v_when := CASE
    WHEN NEW.time ~ '^\d{1,2}:\d{2}' THEN 'Mañana a las ' || substring(NEW.time from '^\d{1,2}:\d{2}')
    ELSE 'Mañana'
  END;

  INSERT INTO scheduled_notifications (
    user_id, notification_type, reference_id, reference_type,
    title, body, data, scheduled_for, status
  ) VALUES (
    NEW.customer_id,
    'booking_reminder',
    NEW.id,
    'booking',
    '¿Confirmás tu turno de mañana?',
    format('%s: %s%s para %s. Tocá Confirmar o Cancelar.',
      v_when,
      COALESCE(NEW.service_name, 'tu turno'),
      COALESCE(' en ' || NEW.partner_name, ''),
      COALESCE(NEW.pet_name, 'tu mascota')),
    jsonb_build_object(
      'type', 'booking_reminder',
      'booking_id', NEW.id,
      'categoryId', 'booking_confirmation',
      'service_name', NEW.service_name,
      'partner_name', NEW.partner_name,
      'pet_name', NEW.pet_name,
      'pet_id', NEW.pet_id,
      'time', NEW.time,
      'appointment_at', v_appointment,
      'channelId', 'bookings'
    ),
    v_reminder,
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_booking_confirmed ON public.bookings;
CREATE TRIGGER on_booking_confirmed
AFTER INSERT OR UPDATE OF status, payment_status, date, time ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.create_booking_reminder_notification();

-- 4 ---------------------------------------------------------------------------
-- Turnos futuros ya confirmados: se reemplazan los recordatorios viejos
-- (agendados a medianoche y sin botones) por los nuevos.
DELETE FROM public.scheduled_notifications sn
 USING public.bookings b
 WHERE sn.reference_id = b.id
   AND sn.reference_type = 'booking'
   AND sn.notification_type = 'booking_reminder'
   AND sn.status = 'pending'
   AND public.booking_appointment_at(b.date, b.time) > now() + interval '24 hours';

INSERT INTO public.scheduled_notifications (
  user_id, notification_type, reference_id, reference_type,
  title, body, data, scheduled_for, status
)
SELECT
  b.customer_id,
  'booking_reminder',
  b.id,
  'booking',
  '¿Confirmás tu turno de mañana?',
  format('%s: %s%s para %s. Tocá Confirmar o Cancelar.',
    CASE WHEN b.time ~ '^\d{1,2}:\d{2}' THEN 'Mañana a las ' || substring(b.time from '^\d{1,2}:\d{2}') ELSE 'Mañana' END,
    COALESCE(b.service_name, 'tu turno'),
    COALESCE(' en ' || b.partner_name, ''),
    COALESCE(b.pet_name, 'tu mascota')),
  jsonb_build_object(
    'type', 'booking_reminder',
    'booking_id', b.id,
    'categoryId', 'booking_confirmation',
    'service_name', b.service_name,
    'partner_name', b.partner_name,
    'pet_name', b.pet_name,
    'pet_id', b.pet_id,
    'time', b.time,
    'appointment_at', public.booking_appointment_at(b.date, b.time),
    'channelId', 'bookings'
  ),
  public.booking_appointment_at(b.date, b.time) - interval '24 hours',
  'pending'
FROM public.bookings b
JOIN public.partners p ON p.id = b.partner_id
WHERE (b.status = 'confirmed' OR b.payment_status = 'approved')
  AND b.status <> 'cancelled'
  AND b.customer_confirmed_at IS NULL
  AND p.business_type IN ('veterinary', 'grooming', 'walking')
  AND public.booking_appointment_at(b.date, b.time) > now() + interval '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.scheduled_notifications sn
     WHERE sn.reference_id = b.id
       AND sn.reference_type = 'booking'
       AND sn.notification_type = 'booking_reminder'
       AND sn.status = 'pending'
  );

-- 6 (antes que 5, porque 5 inserta estos tipos) -------------------------------
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
        'pet_match_message'::text,
        'order_chat_message'::text,
        'booking_customer_confirmed'::text,
        'booking_customer_cancelled'::text
      ]
    )
  ) NOT VALID;

DROP TRIGGER IF EXISTS dispatch_order_notification_now ON public.scheduled_notifications;
CREATE TRIGGER dispatch_order_notification_now
AFTER INSERT ON public.scheduled_notifications
FOR EACH ROW
WHEN (
  NEW.notification_type IN (
    'order_status_change',
    'order_chat_message',
    'booking_customer_confirmed',
    'booking_customer_cancelled'
  )
  AND NEW.status = 'pending'
  AND NEW.scheduled_for <= now()
)
EXECUTE FUNCTION public.dispatch_order_notification_now();

-- 5 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_booking_reminder(p_booking_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_partner_user uuid;
  v_customer text;
  v_when text;
BEGIN
  IF p_action NOT IN ('confirm', 'cancel') THEN
    RAISE EXCEPTION 'invalid_action';
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'booking_not_found';
  END IF;

  IF v_booking.status IN ('cancelled', 'completed') THEN
    RETURN jsonb_build_object('ok', false, 'status', v_booking.status);
  END IF;

  IF public.booking_appointment_at(v_booking.date, v_booking.time) < now() THEN
    RETURN jsonb_build_object('ok', false, 'status', 'past');
  END IF;

  SELECT user_id INTO v_partner_user FROM partners WHERE id = v_booking.partner_id;
  v_customer := COALESCE(NULLIF(split_part(v_booking.customer_name, ' ', 1), ''), 'Tu cliente');
  v_when := to_char(public.booking_appointment_at(v_booking.date, v_booking.time) AT TIME ZONE 'America/Montevideo', 'DD/MM HH24:MI');

  IF p_action = 'confirm' THEN
    UPDATE bookings
       SET customer_confirmed_at = now(),
           status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
           updated_at = now()
     WHERE id = p_booking_id;

    -- Si confirma antes de que salga el recordatorio, ya no hace falta.
    UPDATE scheduled_notifications
       SET status = 'cancelled', updated_at = now()
     WHERE reference_id = p_booking_id
       AND reference_type = 'booking'
       AND notification_type = 'booking_reminder'
       AND status = 'pending';

    IF v_partner_user IS NOT NULL THEN
      INSERT INTO scheduled_notifications (user_id, notification_type, reference_id, reference_type, title, body, data, scheduled_for, status)
      VALUES (
        v_partner_user, 'booking_customer_confirmed', p_booking_id, 'booking',
        v_customer || ' confirmó su turno',
        format('%s para %s · %s', COALESCE(v_booking.service_name, 'Turno'), COALESCE(v_booking.pet_name, 'su mascota'), v_when),
        jsonb_build_object('type', 'booking_customer_confirmed', 'booking_id', p_booking_id, 'screen', 'partner_bookings'),
        now(), 'pending'
      );
    END IF;
  ELSE
    UPDATE bookings
       SET status = 'cancelled',
           customer_cancelled_at = now(),
           updated_at = now()
     WHERE id = p_booking_id;

    UPDATE orders
       SET status = 'cancelled', updated_at = now()
     WHERE booking_id = p_booking_id
       AND status NOT IN ('cancelled', 'completed');

    IF v_partner_user IS NOT NULL THEN
      INSERT INTO scheduled_notifications (user_id, notification_type, reference_id, reference_type, title, body, data, scheduled_for, status)
      VALUES (
        v_partner_user, 'booking_customer_cancelled', p_booking_id, 'booking',
        v_customer || ' canceló su turno',
        format('%s para %s · %s%s', COALESCE(v_booking.service_name, 'Turno'), COALESCE(v_booking.pet_name, 'su mascota'), v_when,
          CASE WHEN v_booking.payment_status = 'approved' THEN '. Estaba pago: revisá la devolución.' ELSE '' END),
        jsonb_build_object('type', 'booking_customer_cancelled', 'booking_id', p_booking_id, 'screen', 'partner_bookings'),
        now(), 'pending'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN p_action = 'confirm' THEN 'confirmed' ELSE 'cancelled' END);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_booking_reminder(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_booking_reminder(uuid, text) TO authenticated;
