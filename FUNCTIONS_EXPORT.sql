/*
  ================================================================================================
  DOGCATIFY - EXPORTACIÓN DE FUNCTIONS (SQL)
  ================================================================================================

  Este archivo contiene todas las funciones SQL de la base de datos

  Total de funciones: 47

  Orden de aplicación:
  1. Funciones de utilidad (update_updated_at_column, etc.)
  2. Funciones de cálculo (calculate_pet_age_weeks, etc.)
  3. Funciones de limpieza (cleanup_*)
  4. Funciones de lógica de negocio (check_boarding_capacity, etc.)
  5. Funciones trigger (handle_new_user, generate_medical_alerts, etc.)

  Última exportación: 2025-11-10

  ================================================================================================
*/

-- ================================================================================================
-- 1. FUNCIONES DE UTILIDAD Y TIMESTAMP
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_app_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_booking_tokens_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_pet_albums_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_pet_behavior_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_pet_shares_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_places_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_promotions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_scheduled_notifications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_webhook_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_adoption_chat_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- ================================================================================================
-- 2. FUNCIONES DE CÁLCULO Y UTILIDAD
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.calculate_pet_age_weeks(pet_data jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
    age_weeks integer := 0;
    age_value numeric;
    age_unit text;
    birth_date date;
BEGIN
    -- Try to get age from age_display first (new format)
    IF pet_data ? 'age_display' AND pet_data->'age_display' ? 'value' AND pet_data->'age_display' ? 'unit' THEN
        age_value := (pet_data->'age_display'->>'value')::numeric;
        age_unit := pet_data->'age_display'->>'unit';

        CASE age_unit
            WHEN 'years' THEN
                age_weeks := (age_value * 52)::integer;
            WHEN 'months' THEN
                age_weeks := (age_value * 4.33)::integer;
            WHEN 'days' THEN
                age_weeks := (age_value / 7)::integer;
            ELSE
                age_weeks := (age_value * 52)::integer;
        END CASE;

    ELSIF pet_data ? 'age' THEN
        age_value := (pet_data->>'age')::numeric;
        age_weeks := (age_value * 52)::integer;

    ELSIF pet_data ? 'created_at' THEN
        BEGIN
            birth_date := (pet_data->>'created_at')::date;
            age_weeks := EXTRACT(days FROM (CURRENT_DATE - birth_date))::integer / 7;
        EXCEPTION WHEN OTHERS THEN
            age_weeks := 52;
        END;

    ELSE
        age_weeks := 52;
    END IF;

    IF age_weeks < 1 THEN
        age_weeks := 1;
    ELSIF age_weeks > 1040 THEN
        age_weeks := 1040;
    END IF;

    RETURN age_weeks;

EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in calculate_pet_age_weeks: %', SQLERRM;
    RETURN 52;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_boarding_capacity(p_service_id uuid, p_category text, p_date date, p_end_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
v_capacity integer;
v_current_bookings integer;
v_available integer;
v_service record;
BEGIN
SELECT
capacity_daily,
capacity_overnight,
capacity_weekend,
capacity_weekly
INTO v_service
FROM partner_services
WHERE id = p_service_id;

CASE p_category
WHEN 'Diario' THEN
v_capacity := v_service.capacity_daily;
WHEN 'Nocturno' THEN
v_capacity := v_service.capacity_overnight;
WHEN 'Fin de semana' THEN
v_capacity := v_service.capacity_weekend;
WHEN 'Semanal' THEN
v_capacity := v_service.capacity_weekly;
ELSE
v_capacity := 0;
END CASE;

IF p_end_date IS NULL THEN
p_end_date := p_date;
END IF;

SELECT COUNT(*)
INTO v_current_bookings
FROM bookings
WHERE service_id = p_service_id
AND boarding_category = p_category
AND status = 'confirmed'
AND (
(date <= p_end_date AND COALESCE(end_date, date) >= p_date)
);

v_available := GREATEST(0, COALESCE(v_capacity, 0) - v_current_bookings);

RETURN jsonb_build_object(
'capacity', v_capacity,
'booked', v_current_bookings,
'available', v_available,
'has_availability', v_available > 0
);
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('invoice_sequence')::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_payment_link_expired(order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
expires_at timestamptz;
BEGIN
SELECT payment_link_expires_at INTO expires_at
FROM orders
WHERE id = order_id;

IF expires_at IS NULL THEN
RETURN true;
END IF;

RETURN expires_at < now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_email_confirmed(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  confirmed boolean := false;
BEGIN
  SELECT email_confirmed INTO confirmed
  FROM profiles
  WHERE id = user_uuid;

  RETURN COALESCE(confirmed, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_has_discount()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.has_discount := (
    (NEW.discount_percentage IS NOT NULL AND NEW.discount_percentage > 0) OR
    (NEW.discount_amount IS NOT NULL AND NEW.discount_amount > 0)
  );

  RETURN NEW;
END;
$function$;

-- ================================================================================================
-- 3. FUNCIONES DE LIMPIEZA (CLEANUP)
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_allergy_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
DELETE FROM allergies_ai_cache
WHERE expires_at < now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_dewormer_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
DELETE FROM dewormers_ai_cache
WHERE expires_at < now() - interval '7 days';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_email_confirmations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM email_confirmations
  WHERE expires_at < now() AND is_confirmed = false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_email_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM email_confirmations
  WHERE expires_at < now() AND is_confirmed = false;

  RAISE NOTICE 'Tokens expirados eliminados';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_illness_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
DELETE FROM illnesses_ai_cache
WHERE expires_at < now();

DELETE FROM treatments_ai_cache
WHERE expires_at < now();

DELETE FROM allergies_ai_cache
WHERE expires_at < now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_medical_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM medical_history_tokens
  WHERE expires_at < now() - interval '1 day';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_vaccine_cache()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
DELETE FROM vaccine_recommendations_cache
WHERE expires_at < now();
END;
$function$;

-- ================================================================================================
-- 4. FUNCIONES DE GESTIÓN DE STOCK Y PRODUCTOS
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.check_and_disable_product()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
IF NEW.stock <= 0 AND (OLD.stock IS NULL OR OLD.stock > 0) THEN
NEW.is_active := false;
RAISE NOTICE '🚫 Producto % desactivado por falta de stock', NEW.id;

ELSIF NEW.stock > 0 AND (OLD.stock IS NULL OR OLD.stock <= 0) THEN
NEW.is_active := true;
RAISE NOTICE '✅ Producto % reactivado con stock: %', NEW.id, NEW.stock;
END IF;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrease_stock_on_order_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
item JSONB;
product_id UUID;
product_quantity INTEGER;
current_stock INTEGER;
BEGIN
IF NEW.order_type = 'product_purchase' THEN

RAISE NOTICE '📦 Procesando descuento de stock para orden %', NEW.id;

FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
LOOP
product_id := (item->>'id')::UUID;
product_quantity := (item->>'quantity')::INTEGER;

RAISE NOTICE '  - Producto: %, Cantidad: %', product_id, product_quantity;

SELECT stock INTO current_stock
FROM partner_products
WHERE id = product_id;

IF current_stock IS NULL THEN
RAISE WARNING '⚠️  Producto % no encontrado', product_id;
CONTINUE;
END IF;

IF current_stock < product_quantity THEN
RAISE WARNING '❌ Stock insuficiente para producto %. Disponible: %, Solicitado: %',
product_id, current_stock, product_quantity;

UPDATE orders
SET status = 'insufficient_stock',
updated_at = NOW()
WHERE id = NEW.id;

RETURN NEW;
END IF;

UPDATE partner_products
SET stock = stock - product_quantity
WHERE id = product_id;

RAISE NOTICE '✅ Stock descontado: Producto %, Nueva cantidad: %',
product_id, current_stock - product_quantity;
END LOOP;

RAISE NOTICE '✅ Descuento de stock completado para orden %', NEW.id;
END IF;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
item JSONB;
product_id UUID;
product_quantity INTEGER;
BEGIN
IF NEW.status = 'cancelled' AND
OLD.status != 'cancelled' AND
NEW.order_type = 'product_purchase' THEN

RAISE NOTICE '🔄 Restaurando stock para orden cancelada %', NEW.id;

FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
LOOP
product_id := (item->>'id')::UUID;
product_quantity := (item->>'quantity')::INTEGER;

RAISE NOTICE '  + Producto: %, Cantidad a restaurar: %', product_id, product_quantity;

UPDATE partner_products
SET stock = stock + product_quantity
WHERE id = product_id;

RAISE NOTICE '✅ Stock restaurado para producto %', product_id;
END LOOP;

RAISE NOTICE '✅ Restauración de stock completada para orden %', NEW.id;
END IF;

RETURN NEW;
END;
$function$;

-- ================================================================================================
-- 5. FUNCIONES DE NOTIFICACIONES
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.create_booking_reminder_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
reminder_time timestamptz;
pet_name_text text;
service_name_text text;
BEGIN
IF NEW.payment_status = 'approved' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'approved') THEN

reminder_time := NEW.date - interval '24 hours';

IF reminder_time > now() THEN

pet_name_text := COALESCE(NEW.pet_name, 'tu mascota');
service_name_text := COALESCE(NEW.service_name, 'servicio');

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
NEW.customer_id,
'booking_reminder',
NEW.id,
'booking',
'¡Recordatorio de Reserva!',
format('Mañana tienes una cita de %s para %s a las %s',
service_name_text,
pet_name_text,
NEW.time
),
jsonb_build_object(
'booking_id', NEW.id,
'service_name', NEW.service_name,
'pet_name', NEW.pet_name,
'date', NEW.date,
'time', NEW.time,
'partner_name', NEW.partner_name,
'screen', 'BookingDetails'
),
reminder_time,
'pending'
)
ON CONFLICT ON CONSTRAINT idx_unique_booking_reminder DO NOTHING;
END IF;
END IF;

IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
UPDATE scheduled_notifications
SET status = 'cancelled', updated_at = now()
WHERE reference_id = NEW.id
AND reference_type = 'booking'
AND notification_type = 'booking_reminder'
AND status = 'pending';
END IF;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_order_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
notification_title text;
notification_body text;
service_date_text text;
service_time_text text;
full_datetime_text text;
BEGIN
IF NEW.status IS DISTINCT FROM OLD.status THEN

IF NEW.order_type = 'service_booking' THEN

service_date_text := COALESCE(
to_char(NEW.appointment_date, 'DD/MM/YYYY'),
'la fecha programada'
);

service_time_text := COALESCE(
to_char(NEW.appointment_date, 'HH12:MI AM'),
NEW.appointment_time
);

IF service_time_text IS NOT NULL THEN
full_datetime_text := format('%s a las %s', service_date_text, service_time_text);
ELSE
full_datetime_text := service_date_text;
END IF;

CASE NEW.status
WHEN 'confirmed' THEN
notification_title := '¡Reserva Confirmada!';
notification_body := format('Tu reserva ha sido confirmada para %s', full_datetime_text);

WHEN 'completed' THEN
notification_title := 'Servicio Completado';
notification_body := '¡Tu servicio ha sido completado! Gracias por confiar en nosotros';

WHEN 'cancelled' THEN
notification_title := 'Reserva Cancelada';
notification_body := 'Tu reserva ha sido cancelada';

ELSE
RETURN NEW;
END CASE;

ELSIF NEW.order_type = 'product_purchase' THEN

CASE NEW.status
WHEN 'confirmed' THEN
notification_title := '¡Pedido Confirmado!';
notification_body := 'Tu pedido ha sido confirmado y está siendo procesado';

WHEN 'preparing' THEN
notification_title := 'Preparando tu Pedido';
notification_body := 'Estamos preparando tu pedido con mucho cuidado';

WHEN 'ready' THEN
notification_title := '¡Pedido Listo!';
notification_body := 'Tu pedido está listo para ser enviado';

WHEN 'shipped' THEN
notification_title := 'Pedido Enviado';
notification_body := 'Tu pedido está en camino. ¡Pronto lo recibirás!';

WHEN 'delivered' THEN
notification_title := '¡Pedido Entregado!';
notification_body := 'Tu pedido ha sido entregado. ¡Esperamos que lo disfrutes!';

WHEN 'completed' THEN
notification_title := 'Pedido Completado';
notification_body := '¡Tu pedido ha sido completado! Gracias por tu compra';

WHEN 'cancelled' THEN
notification_title := 'Pedido Cancelado';
notification_body := 'Tu pedido ha sido cancelado';

ELSE
RETURN NEW;
END CASE;

ELSE
RETURN NEW;
END IF;

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
NEW.customer_id,
'order_status_change',
NEW.id,
'order',
notification_title,
notification_body,
jsonb_build_object(
'order_id', NEW.id,
'order_type', NEW.order_type,
'status', NEW.status,
'total_amount', NEW.total_amount,
'screen', 'OrderDetails'
),
now(),
'pending'
);
END IF;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_vaccine_reminder_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
reminder_7days_time timestamptz;
reminder_24hours_time timestamptz;
pet_name_text text;
vaccine_name_text text;
next_due_date_parsed date;
BEGIN
IF NEW.type = 'vaccine' AND NEW.next_due_date IS NOT NULL AND NEW.next_due_date != '' THEN

BEGIN
next_due_date_parsed := to_date(NEW.next_due_date, 'DD/MM/YYYY');
EXCEPTION WHEN OTHERS THEN
BEGIN
next_due_date_parsed := to_date(NEW.next_due_date, 'YYYY-MM-DD');
EXCEPTION WHEN OTHERS THEN
RETURN NEW;
END;
END;

reminder_7days_time := next_due_date_parsed::timestamptz - interval '7 days';
reminder_24hours_time := next_due_date_parsed::timestamptz - interval '24 hours';

SELECT p.name INTO pet_name_text
FROM pets p
WHERE p.id = NEW.pet_id;

vaccine_name_text := COALESCE(NEW.name, 'vacuna');

IF reminder_7days_time > now() THEN
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
NEW.user_id,
'vaccine_reminder_7days',
NEW.id,
'pet_health',
'🐾 Recordatorio de Vacuna',
format('En 7 días vence el refuerzo de %s para %s',
vaccine_name_text,
pet_name_text
),
jsonb_build_object(
'vaccine_id', NEW.id,
'pet_id', NEW.pet_id,
'pet_name', pet_name_text,
'vaccine_name', vaccine_name_text,
'next_due_date', NEW.next_due_date,
'screen', 'PetDetails',
'tab', 'health'
),
reminder_7days_time,
'pending'
)
ON CONFLICT ON CONSTRAINT idx_unique_vaccine_reminder DO NOTHING;
END IF;

IF reminder_24hours_time > now() THEN
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
NEW.user_id,
'vaccine_reminder_24hours',
NEW.id,
'pet_health',
'⚠️ ¡Vacuna Mañana!',
format('Mañana vence el refuerzo de %s para %s',
vaccine_name_text,
pet_name_text
),
jsonb_build_object(
'vaccine_id', NEW.id,
'pet_id', NEW.pet_id,
'pet_name', pet_name_text,
'vaccine_name', vaccine_name_text,
'next_due_date', NEW.next_due_date,
'screen', 'PetDetails',
'tab', 'health'
),
reminder_24hours_time,
'pending'
)
ON CONFLICT ON CONSTRAINT idx_unique_vaccine_reminder DO NOTHING;
END IF;
END IF;

IF TG_OP = 'UPDATE' AND OLD.type = 'vaccine' THEN
IF (OLD.next_due_date IS DISTINCT FROM NEW.next_due_date) OR NEW.next_due_date IS NULL OR NEW.next_due_date = '' THEN
UPDATE scheduled_notifications
SET status = 'cancelled', updated_at = now()
WHERE reference_id = OLD.id
AND reference_type = 'pet_health'
AND notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
AND status = 'pending';
END IF;
END IF;

IF TG_OP = 'DELETE' AND OLD.type = 'vaccine' THEN
UPDATE scheduled_notifications
SET status = 'cancelled', updated_at = now()
WHERE reference_id = OLD.id
AND reference_type = 'pet_health'
AND notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
AND status = 'pending';
END IF;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_pet_share_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
pet_name_text text;
shared_user_name_text text;
BEGIN
IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
SELECT name INTO pet_name_text FROM pets WHERE id = NEW.pet_id;

SELECT display_name INTO shared_user_name_text
FROM profiles
WHERE id = NEW.shared_with_user_id;

IF shared_user_name_text IS NULL OR shared_user_name_text = '' THEN
SELECT email INTO shared_user_name_text
FROM auth.users
WHERE id = NEW.shared_with_user_id;
END IF;

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
now(),
'pending'
);

RAISE NOTICE 'Notification created for pet share acceptance: % accepted by %', pet_name_text, shared_user_name_text;
END IF;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_pet_share_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
pet_name text;
owner_name text;
deep_link_url text;
https_link_url text;
BEGIN
SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;

SELECT display_name INTO owner_name FROM profiles WHERE id = NEW.owner_id;

deep_link_url := 'dogcatify://pet-share/' || NEW.id;
https_link_url := 'https://dogcatify.app/pet-share/' || NEW.id;

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
$function$;

CREATE OR REPLACE FUNCTION public.send_medical_notifications()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  alert_record RECORD;
  user_profile RECORD;
BEGIN
  FOR alert_record IN
    SELECT ma.*, p.name as pet_name, p.species
    FROM medical_alerts ma
    JOIN pets p ON p.id = ma.pet_id
    WHERE ma.status = 'pending'
    AND ma.due_date <= CURRENT_DATE + INTERVAL '7 days'
    AND ma.due_date > CURRENT_DATE
    AND ma.notification_sent = false
  LOOP
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = alert_record.user_id;

    IF FOUND AND user_profile.notification_preferences->>'push' = 'true' AND user_profile.push_token IS NOT NULL THEN
      UPDATE medical_alerts
      SET notification_sent = true, notification_sent_at = now()
      WHERE id = alert_record.id;

      RAISE NOTICE 'Notification sent for alert: % to user: %', alert_record.title, user_profile.display_name;
    END IF;
  END LOOP;
END;
$function$;

-- ================================================================================================
-- 6. FUNCIONES DE GESTIÓN DE USUARIOS Y AUTENTICACIÓN
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
INSERT INTO public.profiles (id, email, display_name, is_owner, is_partner, email_confirmed)
VALUES (
NEW.id,
NEW.email,
COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
true,
false,
false
)
ON CONFLICT (id) DO NOTHING;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user_completely(user_id_to_delete uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  result json;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF current_user_id != user_id_to_delete THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar esta cuenta';
  END IF;

  DELETE FROM chat_messages WHERE sender_id = user_id_to_delete;
  DELETE FROM chat_conversations WHERE user_id = user_id_to_delete;
  DELETE FROM service_reviews WHERE customer_id = user_id_to_delete;
  DELETE FROM user_carts WHERE user_id = user_id_to_delete;
  DELETE FROM orders WHERE customer_id = user_id_to_delete;
  DELETE FROM bookings WHERE customer_id = user_id_to_delete;
  DELETE FROM comments WHERE user_id = user_id_to_delete;
  DELETE FROM posts WHERE user_id = user_id_to_delete;
  DELETE FROM pet_behavior WHERE user_id = user_id_to_delete;
  DELETE FROM pet_health WHERE user_id = user_id_to_delete;
  DELETE FROM pet_albums WHERE user_id = user_id_to_delete;
  DELETE FROM pets WHERE owner_id = user_id_to_delete;
  DELETE FROM profiles WHERE id = user_id_to_delete;

  IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id_to_delete) THEN
    RAISE EXCEPTION 'No se pudo eliminar el perfil del usuario';
  END IF;

  result := json_build_object(
    'success', true,
    'message', 'Usuario eliminado completamente',
    'user_id', user_id_to_delete
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', user_id_to_delete
    );
    RETURN result;
END;
$function$;

-- ================================================================================================
-- 7. FUNCIONES DE ALERTAS MÉDICAS
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.generate_alerts_for_new_pet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    pet_age_weeks integer;
    pet_species text;
    alert_data jsonb;
BEGIN
    BEGIN
        pet_species := COALESCE(NEW.species, 'dog');

        alert_data := jsonb_build_object(
            'age', COALESCE(NEW.age, 1),
            'age_display', COALESCE(NEW.age_display, jsonb_build_object('value', COALESCE(NEW.age, 1), 'unit', 'years')),
            'species', pet_species,
            'created_at', NEW.created_at
        );

        pet_age_weeks := calculate_pet_age_weeks(alert_data);

        RAISE NOTICE 'Calculated age for pet %: % weeks', NEW.name, pet_age_weeks;

        IF pet_age_weeks < 16 THEN
            INSERT INTO medical_alerts (
                pet_id,
                user_id,
                alert_type,
                title,
                description,
                due_date,
                priority,
                status,
                metadata
            ) VALUES (
                NEW.id,
                NEW.owner_id,
                'vaccine',
                'Vacunación inicial requerida',
                CASE
                    WHEN pet_species = 'dog' THEN 'Es hora de las primeras vacunas para ' || NEW.name || '. Consulta con un veterinario sobre el calendario de vacunación.'
                    ELSE 'Es hora de las primeras vacunas para ' || NEW.name || '. Consulta con un veterinario sobre el calendario de vacunación.'
                END,
                CURRENT_DATE + INTERVAL '7 days',
                'high',
                'pending',
                jsonb_build_object(
                    'pet_age_weeks', pet_age_weeks,
                    'species', pet_species,
                    'alert_reason', 'new_pet_vaccination'
                )
            );

        ELSIF pet_age_weeks >= 52 THEN
            INSERT INTO medical_alerts (
                pet_id,
                user_id,
                alert_type,
                title,
                description,
                due_date,
                priority,
                status,
                metadata
            ) VALUES (
                NEW.id,
                NEW.owner_id,
                'checkup',
                'Revisión médica anual',
                'Es recomendable hacer una revisión médica anual para ' || NEW.name || '. Programa una cita con tu veterinario.',
                CURRENT_DATE + INTERVAL '30 days',
                'medium',
                'pending',
                jsonb_build_object(
                    'pet_age_weeks', pet_age_weeks,
                    'species', pet_species,
                    'alert_reason', 'annual_checkup'
                )
            );
        END IF;

        INSERT INTO medical_alerts (
            pet_id,
            user_id,
            alert_type,
            title,
            description,
            due_date,
            priority,
            status,
            metadata
        ) VALUES (
            NEW.id,
            NEW.owner_id,
            'deworming',
            'Desparasitación recomendada',
            'Es importante mantener a ' || NEW.name || ' libre de parásitos. Consulta con tu veterinario sobre el programa de desparasitación.',
            CURRENT_DATE + INTERVAL '14 days',
            'medium',
            'pending',
            jsonb_build_object(
                'pet_age_weeks', pet_age_weeks,
                'species', pet_species,
                'alert_reason', 'deworming_schedule'
            )
        );

        RAISE NOTICE 'Medical alerts generated successfully for pet %', NEW.name;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error generating alerts for new pet %: % - %', NEW.name, SQLSTATE, SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_medical_alerts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
pet_record RECORD;
alert_date DATE;
alert_title TEXT;
alert_description TEXT;
alert_priority TEXT := 'medium';
existing_alert_count INTEGER;
BEGIN
SELECT * INTO pet_record FROM pets WHERE id = NEW.pet_id;

IF NOT FOUND THEN
RAISE WARNING 'Pet not found for health record %', NEW.id;
RETURN NEW;
END IF;

CASE NEW.type
WHEN 'vaccine' THEN
IF NEW.next_due_date IS NOT NULL AND NEW.next_due_date != '' THEN
BEGIN
alert_date := to_date(NEW.next_due_date, 'DD/MM/YYYY');
alert_date := alert_date - INTERVAL '7 days';

IF alert_date > CURRENT_DATE THEN
alert_title := 'Refuerzo de vacuna: ' || COALESCE(NEW.name, 'Vacuna');
alert_description := 'Es hora del refuerzo de ' || COALESCE(NEW.name, 'vacuna') || ' para ' || pet_record.name;

IF NEW.name ILIKE '%DHPP%' OR NEW.name ILIKE '%rabia%' OR NEW.name ILIKE '%triple%' THEN
alert_priority := 'high';
END IF;

SELECT COUNT(*) INTO existing_alert_count
FROM medical_alerts
WHERE pet_id = NEW.pet_id
AND title = alert_title
AND due_date = alert_date
AND status = 'pending';

IF existing_alert_count = 0 THEN
INSERT INTO medical_alerts (
pet_id,
user_id,
alert_type,
title,
description,
due_date,
priority,
status,
related_record_id,
metadata
) VALUES (
NEW.pet_id,
NEW.user_id,
'vaccine',
alert_title,
alert_description,
alert_date,
alert_priority,
'pending',
NEW.id,
jsonb_build_object(
'vaccine_name', NEW.name,
'last_application', NEW.application_date,
'veterinarian', NEW.veterinarian
)
)
ON CONFLICT ON CONSTRAINT idx_medical_alerts_unique_pending DO NOTHING;
END IF;
END IF;
EXCEPTION
WHEN OTHERS THEN
RAISE WARNING 'Error parsing vaccine date %: %', NEW.next_due_date, SQLERRM;
END;
END IF;

WHEN 'deworming' THEN
IF NEW.next_due_date IS NOT NULL AND NEW.next_due_date != '' THEN
BEGIN
alert_date := to_date(NEW.next_due_date, 'DD/MM/YYYY');
alert_date := alert_date - INTERVAL '3 days';

IF alert_date > CURRENT_DATE THEN
alert_title := 'Desparasitación pendiente';
alert_description := 'Es hora de desparasitar a ' || pet_record.name;

SELECT COUNT(*) INTO existing_alert_count
FROM medical_alerts
WHERE pet_id = NEW.pet_id
AND title = alert_title
AND due_date = alert_date
AND status = 'pending';

IF existing_alert_count = 0 THEN
INSERT INTO medical_alerts (
pet_id,
user_id,
alert_type,
title,
description,
due_date,
priority,
status,
related_record_id,
metadata
) VALUES (
NEW.pet_id,
NEW.user_id,
'deworming',
alert_title,
alert_description,
alert_date,
'medium',
'pending',
NEW.id,
jsonb_build_object(
'product_name', NEW.product_name,
'last_application', NEW.application_date
)
)
ON CONFLICT ON CONSTRAINT idx_medical_alerts_unique_pending DO NOTHING;
END IF;
END IF;
EXCEPTION
WHEN OTHERS THEN
RAISE WARNING 'Error parsing deworming date %: %', NEW.next_due_date, SQLERRM;
END;
END IF;

WHEN 'illness' THEN
IF NEW.status = 'active' THEN
alert_date := CURRENT_DATE + INTERVAL '3 months';
alert_title := 'Revisión médica: ' || COALESCE(NEW.name, 'Condición');
alert_description := 'Revisión de seguimiento para ' || COALESCE(NEW.name, 'condición médica') || ' de ' || pet_record.name;

SELECT COUNT(*) INTO existing_alert_count
FROM medical_alerts
WHERE pet_id = NEW.pet_id
AND title = alert_title
AND due_date = alert_date
AND status = 'pending';

IF existing_alert_count = 0 THEN
INSERT INTO medical_alerts (
pet_id,
user_id,
alert_type,
title,
description,
due_date,
priority,
status,
related_record_id,
metadata
) VALUES (
NEW.pet_id,
NEW.user_id,
'checkup',
alert_title,
alert_description,
alert_date,
'medium',
'pending',
NEW.id,
jsonb_build_object(
'condition_name', NEW.name,
'diagnosis_date', NEW.diagnosis_date
)
)
ON CONFLICT ON CONSTRAINT idx_medical_alerts_unique_pending DO NOTHING;
END IF;
END IF;
END CASE;

RETURN NEW;
EXCEPTION
WHEN OTHERS THEN
RAISE WARNING 'Error generating medical alerts for health record %: %', NEW.id, SQLERRM;
RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_generate_alerts_new_pet()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM generate_alerts_for_new_pet();
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Alert generation failed, but pet creation continues: %', SQLERRM;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_generate_medical_alerts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM generate_medical_alerts(NEW.pet_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_alert_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE medical_alerts
  SET
    status = 'completed',
    completed_at = CURRENT_TIMESTAMP
  WHERE
    pet_id = NEW.pet_id
    AND alert_type = NEW.type
    AND status = 'pending'
    AND due_date <= CURRENT_DATE + INTERVAL '7 days';

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error updating alert status: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- ================================================================================================
-- 8. FUNCIONES DE WEBHOOKS Y PAGOS
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.mark_payment_as_failed(order_id uuid, reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
UPDATE orders
SET
status = 'payment_failed',
updated_at = now()
WHERE id = order_id
AND status IN ('pending', 'payment_failed');
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_order_webhook()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
event_type text;
webhook_payload jsonb;
BEGIN
IF TG_OP = 'INSERT' THEN
event_type := 'order.created';
ELSIF TG_OP = 'UPDATE' THEN
IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
event_type := 'order.cancelled';
ELSIF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
event_type := 'order.completed';
ELSE
event_type := 'order.updated';
END IF;
ELSE
RETURN NEW;
END IF;

webhook_payload := jsonb_build_object(
'order_id', NEW.id,
'event_type', event_type,
'partner_id', NEW.partner_id,
'status', NEW.status,
'timestamp', now()
);

PERFORM pg_notify('order_webhook', webhook_payload::text);

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_webhook_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
event_type text;
function_url text;
supabase_url text;
payload jsonb;
BEGIN
IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
RAISE NOTICE 'Skipping webhook for free service order: %', NEW.id;
RETURN NEW;
END IF;

IF TG_OP = 'INSERT' THEN
event_type := 'order.created';
ELSIF TG_OP = 'UPDATE' THEN
IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
event_type := 'order.cancelled';
ELSIF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
event_type := 'order.completed';
ELSE
event_type := 'order.updated';
END IF;
ELSE
RETURN NEW;
END IF;

supabase_url := current_setting('app.settings.supabase_url', true);

IF supabase_url IS NULL OR supabase_url = '' THEN
supabase_url := 'https://zkgiwamycbjcogcgqhff.supabase.co';
END IF;

function_url := supabase_url || '/functions/v1/notify-order-webhook';

payload := jsonb_build_object(
'order_id', NEW.id,
'event_type', event_type
);

BEGIN
PERFORM net.http_post(
url := function_url,
headers := jsonb_build_object(
'Content-Type', 'application/json',
'x-webhook-trigger', 'true'
),
body := payload
);

RAISE NOTICE 'Webhook notification sent for order % with event %', NEW.id, event_type;

EXCEPTION WHEN OTHERS THEN
RAISE WARNING 'Failed to send webhook notification for order %: %', NEW.id, SQLERRM;
END;

RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.invoke_webhook_edge_function(order_id_param uuid, event_type_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
supabase_url text;
supabase_anon_key text;
function_url text;
request_payload jsonb;
BEGIN
supabase_url := current_setting('app.settings.supabase_url', true);
supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);

IF supabase_url IS NULL OR supabase_anon_key IS NULL THEN
RAISE NOTICE 'Supabase URL or Anon Key not configured';
RETURN;
END IF;

function_url := supabase_url || '/functions/v1/notify-order-webhook';

request_payload := jsonb_build_object(
'order_id', order_id_param,
'event_type', event_type_param
);

RAISE NOTICE 'Webhook notification queued for order % with event %', order_id_param, event_type_param;
END;
$function$;

-- ================================================================================================
-- 9. FUNCIONES DE CHAT Y CONVERSACIONES
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE chat_conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

-- ================================================================================================
-- 10. FUNCIONES DE RATINGS Y RESEÑAS
-- ================================================================================================

CREATE OR REPLACE FUNCTION public.update_partner_rating()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE partners
  SET
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM service_reviews
      WHERE partner_id = COALESCE(NEW.partner_id, OLD.partner_id)
    ),
    reviews_count = (
      SELECT COUNT(*)
      FROM service_reviews
      WHERE partner_id = COALESCE(NEW.partner_id, OLD.partner_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.partner_id, OLD.partner_id);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ================================================================================================
-- FIN DE EXPORTACIÓN DE FUNCIONES
-- ================================================================================================

/*
  VERIFICACIÓN POST-APLICACIÓN:

  -- Contar funciones creadas
  SELECT count(*) FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION';
  -- Debe retornar: 47

  -- Ver funciones por nombre
  SELECT routine_name, routine_type, data_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  ORDER BY routine_name;
*/
