-- Chat entre cliente y local para pedidos confirmados, con push al instante.
--
-- 1. chat_conversations gana order_id: una conversación por pedido, reutilizando
--    las mismas tablas, RLS y pantalla de chat que ya usan las adopciones.
-- 2. get_or_create_order_chat(order_id): solo el cliente o el dueño del local
--    pueden abrirla, y solo con el pedido confirmado y todavía en curso.
-- 3. Con el pedido terminado (entregado, cancelado, etc.) no se aceptan mensajes.
-- 4. Cada mensaje genera una notificación push para la otra parte.
-- 5. Las notificaciones de pedidos (mensajes y cambios de estado) se despachan
--    en el momento, sin esperar al cron de 15 minutos, que queda de respaldo.

-- 1 ---------------------------------------------------------------------------
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_order_id_key
  ON public.chat_conversations (order_id)
  WHERE order_id IS NOT NULL;

-- Estados en los que el chat del pedido está abierto.
CREATE OR REPLACE FUNCTION public.is_order_chat_open(p_status text) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status = ANY (ARRAY['confirmed', 'preparing', 'processing', 'ready_for_delivery', 'shipped']);
$$;

-- 2 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_order_chat(p_order_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_partner_owner uuid;
  v_conversation_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id, customer_id, partner_id, status
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  SELECT user_id INTO v_partner_owner FROM public.partners WHERE id = v_order.partner_id;

  IF auth.uid() IS DISTINCT FROM v_order.customer_id AND auth.uid() IS DISTINCT FROM v_partner_owner THEN
    RAISE EXCEPTION 'not_order_participant';
  END IF;

  SELECT id INTO v_conversation_id
    FROM public.chat_conversations
   WHERE order_id = p_order_id;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  IF NOT public.is_order_chat_open(v_order.status) THEN
    RAISE EXCEPTION 'order_chat_closed';
  END IF;

  INSERT INTO public.chat_conversations (order_id, partner_id, user_id, status)
  VALUES (p_order_id, v_order.partner_id, v_order.customer_id, 'active')
  ON CONFLICT (order_id) WHERE order_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_conversation_id;

  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id FROM public.chat_conversations WHERE order_id = p_order_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_order_chat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_order_chat(uuid) TO authenticated;

-- 3 ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_order_chat_open() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT o.status INTO v_status
    FROM public.chat_conversations c
    JOIN public.orders o ON o.id = c.order_id
   WHERE c.id = NEW.conversation_id;

  IF FOUND AND NOT public.is_order_chat_open(v_status) THEN
    RAISE EXCEPTION 'order_chat_closed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_chat_open ON public.chat_messages;
CREATE TRIGGER enforce_order_chat_open
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_chat_open();

-- 4 ---------------------------------------------------------------------------
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
        'order_chat_message'::text
      ]
    )
  ) NOT VALID;

ALTER TABLE public.scheduled_notifications
  DROP CONSTRAINT IF EXISTS scheduled_notifications_reference_type_check;

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
        'pet_match_message'::text,
        'order_chat_message'::text
      ]
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.notify_order_chat_message() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation record;
  v_partner_owner uuid;
  v_partner_name text;
  v_customer_name text;
  v_order_ref text;
  v_recipient uuid;
  v_recipient_role text;
  v_title text;
  v_body text;
BEGIN
  SELECT c.id, c.order_id, c.user_id, c.partner_id, o.order_number
    INTO v_conversation
    FROM public.chat_conversations c
    JOIN public.orders o ON o.id = c.order_id
   WHERE c.id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW; -- no es un chat de pedido
  END IF;

  SELECT user_id, business_name INTO v_partner_owner, v_partner_name
    FROM public.partners WHERE id = v_conversation.partner_id;
  SELECT display_name INTO v_customer_name
    FROM public.profiles WHERE id = v_conversation.user_id;

  v_order_ref := COALESCE(v_conversation.order_number, '#' || right(v_conversation.order_id::text, 6));
  v_body := left(NEW.message, 140);

  IF NEW.sender_id = v_conversation.user_id THEN
    v_recipient := v_partner_owner;
    v_recipient_role := 'partner';
    v_title := COALESCE(NULLIF(split_part(v_customer_name, ' ', 1), ''), 'Tu cliente') || ' · Pedido ' || v_order_ref;
  ELSE
    v_recipient := v_conversation.user_id;
    v_recipient_role := 'customer';
    v_title := COALESCE(v_partner_name, 'La tienda') || ' · Pedido ' || v_order_ref;
  END IF;

  IF v_recipient IS NULL OR v_recipient = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.scheduled_notifications (
    user_id, notification_type, reference_id, reference_type,
    title, body, data, scheduled_for, status
  )
  VALUES (
    v_recipient,
    'order_chat_message',
    NEW.id,
    'order_chat_message',
    v_title,
    v_body,
    jsonb_build_object(
      'screen', 'chat_message',
      'type', 'chat_message',
      'conversation_id', NEW.conversation_id,
      'order_id', v_conversation.order_id,
      'order_number', v_conversation.order_number,
      'partner_id', v_conversation.partner_id,
      'recipient_role', v_recipient_role
    ),
    now(),
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_order_chat_message ON public.chat_messages;
CREATE TRIGGER notify_order_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_order_chat_message();

-- 5 ---------------------------------------------------------------------------
-- Reutiliza la misma llamada del cron (URL desde admin_settings). Si falla,
-- la notificación queda 'pending' y el cron la envía en su próxima corrida.
CREATE OR REPLACE FUNCTION public.dispatch_order_notification_now() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.send_scheduled_notifications_cron();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'dispatch_order_notification_now: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispatch_order_notification_now ON public.scheduled_notifications;
CREATE TRIGGER dispatch_order_notification_now
AFTER INSERT ON public.scheduled_notifications
FOR EACH ROW
WHEN (
  NEW.notification_type IN ('order_status_change', 'order_chat_message')
  AND NEW.status = 'pending'
  AND NEW.scheduled_for <= now()
)
EXECUTE FUNCTION public.dispatch_order_notification_now();
