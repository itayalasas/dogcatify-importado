


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."calculate_pet_age_weeks"("pet_data" "jsonb") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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
                age_weeks := (age_value * 4.33)::integer; -- Average weeks per month
            WHEN 'days' THEN
                age_weeks := (age_value / 7)::integer;
            ELSE
                age_weeks := (age_value * 52)::integer; -- Default to years
        END CASE;
        
    -- Fallback to simple age field (old format)
    ELSIF pet_data ? 'age' THEN
        age_value := (pet_data->>'age')::numeric;
        age_weeks := (age_value * 52)::integer; -- Assume years
        
    -- If we have created_at, calculate from that
    ELSIF pet_data ? 'created_at' THEN
        BEGIN
            birth_date := (pet_data->>'created_at')::date;
            age_weeks := EXTRACT(days FROM (CURRENT_DATE - birth_date))::integer / 7;
        EXCEPTION WHEN OTHERS THEN
            age_weeks := 52; -- Default to 1 year if date parsing fails
        END;
        
    ELSE
        -- Default fallback
        age_weeks := 52; -- Default to 1 year
    END IF;
    
    -- Ensure reasonable bounds
    IF age_weeks < 1 THEN
        age_weeks := 1;
    ELSIF age_weeks > 1040 THEN -- Max 20 years
        age_weeks := 1040;
    END IF;
    
    RETURN age_weeks;
    
EXCEPTION WHEN OTHERS THEN
    -- If anything fails, return a safe default
    RAISE WARNING 'Error in calculate_pet_age_weeks: %', SQLERRM;
    RETURN 52; -- Default to 1 year
END;
$$;


ALTER FUNCTION "public"."calculate_pet_age_weeks"("pet_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_alert_thresholds_cron"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
request_id bigint;
supabase_url text := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
service_role_key text;
BEGIN
service_role_key := current_setting('app.settings.service_role_key', true);

IF service_role_key IS NULL THEN
service_role_key := current_setting('supabase.service_role_key', true);
END IF;

SELECT INTO request_id net.http_post(
url := supabase_url || '/functions/v1/check-alert-thresholds',
headers := jsonb_build_object(
'Authorization', 'Bearer ' || COALESCE(service_role_key, ''),
'Content-Type', 'application/json'
),
body := '{}'::jsonb,
timeout_milliseconds := 30000
);

INSERT INTO audit_logs (
user_email,
action,
resource_type,
success,
details
) VALUES (
'system@dogcatify.com',
'CRON_ALERT_CHECK',
'system_cron',
true,
jsonb_build_object(
'job', 'check_alert_thresholds',
'executed_at', NOW(),
'request_id', request_id,
'cron_schedule', '*/5 * * * *',
'function_url', supabase_url || '/functions/v1/check-alert-thresholds'
)
);

EXCEPTION
WHEN OTHERS THEN
INSERT INTO audit_logs (
user_email,
action,
resource_type,
success,
error_message,
details
) VALUES (
'system@dogcatify.com',
'CRON_ALERT_CHECK',
'system_cron',
false,
SQLERRM,
jsonb_build_object(
'job', 'check_alert_thresholds',
'executed_at', NOW(),
'error_detail', SQLSTATE,
'error_context', SQLERRM
)
);
END;
$$;


ALTER FUNCTION "public"."check_alert_thresholds_cron"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_disable_product"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_and_disable_product"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_and_disable_product"() IS 'Desactiva productos cuando stock=0 y los reactiva cuando vuelve a haber stock';



CREATE OR REPLACE FUNCTION "public"."check_boarding_capacity"("p_service_id" "uuid", "p_category" "text", "p_date" "date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_boarding_capacity"("p_service_id" "uuid", "p_category" "text", "p_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_allergy_cache"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
DELETE FROM allergies_ai_cache
WHERE expires_at < now();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_allergy_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_dewormer_cache"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
DELETE FROM dewormers_ai_cache
WHERE expires_at < now() - interval '7 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_dewormer_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_email_confirmations"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM email_confirmations 
  WHERE expires_at < now() AND is_confirmed = false;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_email_confirmations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_email_tokens"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM email_confirmations
  WHERE expires_at < now() AND is_confirmed = false;

  RAISE NOTICE 'Tokens expirados eliminados';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_email_tokens"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_illness_cache"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
DELETE FROM illnesses_ai_cache
WHERE expires_at < now();

DELETE FROM treatments_ai_cache
WHERE expires_at < now();

DELETE FROM allergies_ai_cache
WHERE expires_at < now();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_illness_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_medical_tokens"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM medical_history_tokens 
  WHERE expires_at < now() - interval '1 day';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_medical_tokens"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_vaccine_cache"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
DELETE FROM vaccine_recommendations_cache
WHERE expires_at < now();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_vaccine_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_reminder_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
) 
SELECT
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
WHERE NOT EXISTS (
SELECT 1 FROM scheduled_notifications
WHERE reference_id = NEW.id
AND reference_type = 'booking'
AND notification_type = 'booking_reminder'
AND status = 'pending'
);
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
$$;


ALTER FUNCTION "public"."create_booking_reminder_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_for_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_commission_percentage NUMERIC;
v_commission_amount NUMERIC;
v_partner_amount NUMERIC;
v_iva_amount NUMERIC;
v_partner_breakdown JSONB;
v_order_status TEXT;
v_payment_status TEXT;
v_iva_rate NUMERIC := 22;
v_partner_rut TEXT;
v_partner_email TEXT;
v_partner_phone TEXT;
v_partner_address TEXT;
v_items JSONB;
v_order_number TEXT;
v_order_id UUID;
BEGIN
IF EXISTS (SELECT 1 FROM orders WHERE booking_id = NEW.id) THEN
RETURN NEW;
END IF;

v_order_number := generate_order_number();

SELECT 
commission_percentage,
rut,
email,
phone,
address
INTO 
v_commission_percentage,
v_partner_rut,
v_partner_email,
v_partner_phone,
v_partner_address
FROM partners
WHERE id = NEW.partner_id;

v_commission_percentage := COALESCE(v_commission_percentage, 5);

v_commission_amount := (NEW.total_amount * v_commission_percentage) / 100;
v_partner_amount := NEW.total_amount - v_commission_amount;
v_iva_amount := (NEW.total_amount * v_iva_rate) / 100;

IF NEW.payment_method = 'payment_link' THEN
v_order_status := 'pending';
v_payment_status := 'pending';
ELSE
v_order_status := 'confirmed';
v_payment_status := COALESCE(NEW.payment_status, 'approved');
END IF;

v_items := jsonb_build_array(
jsonb_build_object(
'id', COALESCE(NEW.service_id::text, NEW.id::text),
'name', COALESCE(NEW.service_name, 'Servicio'),
'type', 'service',
'price', NEW.total_amount,
'currency', 'UYU',
'currency_code_dgi', '858',
'iva_rate', v_iva_rate,
'quantity', 1,
'subtotal', NEW.total_amount,
'iva_amount', v_iva_amount,
'partnerId', NEW.partner_id,
'partnerName', COALESCE(NEW.partner_name, 'Partner'),
'partner_name', COALESCE(NEW.partner_name, 'Partner'),
'original_price', NEW.total_amount,
'discount_percentage', 0
)
);

v_partner_breakdown := jsonb_build_object(
'iva_rate', v_iva_rate,
'partners', jsonb_build_object(
NEW.partner_id::text, jsonb_build_object(
'partner_id', NEW.partner_id,
'partner_name', COALESCE(NEW.partner_name, 'Partner'),
'partner_rut', v_partner_rut,
'partner_email', v_partner_email,
'partner_phone', v_partner_phone,
'partner_address', v_partner_address,
'items', jsonb_build_array(
jsonb_build_object(
'id', COALESCE(NEW.service_id::text, NEW.id::text),
'name', COALESCE(NEW.service_name, 'Servicio'),
'price', NEW.total_amount,
'total', NEW.total_amount,
'quantity', 1,
'subtotal', NEW.total_amount,
'iva_amount', v_iva_amount
)
),
'subtotal', NEW.total_amount
)
),
'iva_amount', v_iva_amount,
'iva_included', false,
'shipping_cost', 0,
'total_partners', 1,
'commission_split', v_commission_amount
);

INSERT INTO orders (
partner_id,
customer_id,
booking_id,
order_type,
service_id,
pet_id,
status,
total_amount,
subtotal,
iva_rate,
iva_amount,
iva_included_in_price,
shipping_cost,
commission_amount,
partner_amount,
partner_breakdown,
partner_name,
service_name,
pet_name,
customer_name,
customer_email,
customer_phone,
appointment_date,
appointment_time,
payment_method,
payment_status,
payment_preference_id,
payment_data,
booking_notes,
items,
order_number
) VALUES (
NEW.partner_id,
NEW.customer_id,
NEW.id,
'service_booking',
NEW.service_id,
NEW.pet_id,
v_order_status,
NEW.total_amount,
NEW.total_amount,
v_iva_rate,
v_iva_amount,
false,
0,
v_commission_amount,
v_partner_amount,
v_partner_breakdown,
NEW.partner_name,
NEW.service_name,
NEW.pet_name,
NEW.customer_name,
NEW.customer_email,
NEW.customer_phone,
NEW.date,
NEW.time,
COALESCE(NEW.payment_method, 'cash'),
v_payment_status,
NEW.payment_preference_id,
NEW.payment_data,
NEW.notes,
v_items,
v_order_number
) RETURNING id INTO v_order_id;

UPDATE bookings
SET order_number = v_order_number
WHERE id = NEW.id;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_order_for_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_status_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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

service_time_text := format_time_12h(NEW.appointment_time);

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
now(), -- Enviar inmediatamente
'pending'
);
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_order_status_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_vaccine_reminder_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  reminder_7days_time timestamptz;
  reminder_24hours_time timestamptz;
  pet_name_text text;
  vaccine_name_text text;
  next_due_date_parsed date;
BEGIN
  -- Solo procesar si es una vacuna
  IF NEW.type = 'vaccine' AND NEW.next_due_date IS NOT NULL AND NEW.next_due_date != '' THEN
    
    -- Parsear fecha de próxima dosis (formato DD/MM/YYYY)
    BEGIN
      next_due_date_parsed := to_date(NEW.next_due_date, 'DD/MM/YYYY');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        next_due_date_parsed := to_date(NEW.next_due_date, 'YYYY-MM-DD');
      EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
      END;
    END;
    
    -- Calcular tiempos de recordatorio
    reminder_7days_time := next_due_date_parsed::timestamptz - interval '7 days';
    reminder_24hours_time := next_due_date_parsed::timestamptz - interval '24 hours';
    
    -- Obtener nombre de mascota
    SELECT p.name INTO pet_name_text FROM pets p WHERE p.id = NEW.pet_id;
    
    -- Usar nombre de vacuna
    vaccine_name_text := COALESCE(NEW.name, 'vacuna');
    
    -- Cancelar notificaciones pendientes existentes
    UPDATE scheduled_notifications
    SET status = 'cancelled', updated_at = now()
    WHERE reference_id = NEW.id 
      AND reference_type = 'pet_health'
      AND notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
      AND status = 'pending';
    
    -- NOTIFICACIÓN 1: 7 días antes
    IF reminder_7days_time > now() THEN
      INSERT INTO scheduled_notifications (
        user_id, notification_type, reference_id, reference_type,
        title, body, data, scheduled_for, status
      ) VALUES (
        NEW.user_id, 'vaccine_reminder_7days', NEW.id, 'pet_health',
        '🐾 Recordatorio de Vacuna',
        format('En 7 días vence el refuerzo de %s para %s', vaccine_name_text, pet_name_text),
        jsonb_build_object(
          'vaccine_id', NEW.id, 'pet_id', NEW.pet_id,
          'pet_name', pet_name_text, 'vaccine_name', vaccine_name_text,
          'next_due_date', NEW.next_due_date, 'screen', 'PetDetails', 'tab', 'health'
        ),
        reminder_7days_time, 'pending'
      )
      ON CONFLICT (reference_id, notification_type, status) 
      WHERE notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
      DO UPDATE SET
        scheduled_for = EXCLUDED.scheduled_for,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        updated_at = now();
    END IF;
    
    -- NOTIFICACIÓN 2: 24 horas antes
    IF reminder_24hours_time > now() THEN
      INSERT INTO scheduled_notifications (
        user_id, notification_type, reference_id, reference_type,
        title, body, data, scheduled_for, status
      ) VALUES (
        NEW.user_id, 'vaccine_reminder_24hours', NEW.id, 'pet_health',
        '⚠️ ¡Vacuna Mañana!',
        format('Mañana vence el refuerzo de %s para %s', vaccine_name_text, pet_name_text),
        jsonb_build_object(
          'vaccine_id', NEW.id, 'pet_id', NEW.pet_id,
          'pet_name', pet_name_text, 'vaccine_name', vaccine_name_text,
          'next_due_date', NEW.next_due_date, 'screen', 'PetDetails', 'tab', 'health'
        ),
        reminder_24hours_time, 'pending'
      )
      ON CONFLICT (reference_id, notification_type, status) 
      WHERE notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
      DO UPDATE SET
        scheduled_for = EXCLUDED.scheduled_for,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        updated_at = now();
    END IF;
  END IF;
  
  -- Si se actualiza o elimina, cancelar notificaciones pendientes
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
$$;


ALTER FUNCTION "public"."create_vaccine_reminder_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrease_stock_on_order_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."decrease_stock_on_order_insert"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."decrease_stock_on_order_insert"() IS 'Descuenta automáticamente el stock de productos al CREAR una orden. El campo updated_at se actualiza automáticamente por su propio trigger.';



CREATE OR REPLACE FUNCTION "public"."delete_user_completely"("user_id_to_delete" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_user_id uuid;
  result json;
BEGIN
  -- Verificar que el usuario autenticado sea el mismo que se está eliminando
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;
  
  IF current_user_id != user_id_to_delete THEN
    RAISE EXCEPTION 'No tienes permisos para eliminar esta cuenta';
  END IF;
  
  -- Eliminar datos relacionados en orden (para evitar violaciones de foreign key)
  
  -- 1. Eliminar mensajes de chat
  DELETE FROM chat_messages WHERE sender_id = user_id_to_delete;
  
  -- 2. Eliminar conversaciones de chat
  DELETE FROM chat_conversations WHERE user_id = user_id_to_delete;
  
  -- 3. Eliminar reseñas de servicios
  DELETE FROM service_reviews WHERE customer_id = user_id_to_delete;
  
  -- 4. Eliminar carrito de usuario
  DELETE FROM user_carts WHERE user_id = user_id_to_delete;
  
  -- 5. Eliminar pedidos
  DELETE FROM orders WHERE customer_id = user_id_to_delete;
  
  -- 6. Eliminar reservas
  DELETE FROM bookings WHERE customer_id = user_id_to_delete;
  
  -- 7. Eliminar comentarios
  DELETE FROM comments WHERE user_id = user_id_to_delete;
  
  -- 8. Eliminar posts (esto también eliminará comentarios relacionados por CASCADE)
  DELETE FROM posts WHERE user_id = user_id_to_delete;
  
  -- 9. Eliminar datos de mascotas
  DELETE FROM pet_behavior WHERE user_id = user_id_to_delete;
  DELETE FROM pet_health WHERE user_id = user_id_to_delete;
  DELETE FROM pet_albums WHERE user_id = user_id_to_delete;
  DELETE FROM pets WHERE owner_id = user_id_to_delete;
  
  -- 10. Finalmente, eliminar el perfil del usuario
  DELETE FROM profiles WHERE id = user_id_to_delete;
  
  -- Verificar que el perfil se eliminó
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
    -- En caso de error, retornar información del error
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', user_id_to_delete
    );
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."delete_user_completely"("user_id_to_delete" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_time_12h"("time_24h" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
hour_int int;
minute_str text;
period text;
formatted_hour int;
BEGIN
IF time_24h IS NULL OR time_24h = '' THEN
RETURN NULL;
END IF;

hour_int := CAST(split_part(time_24h, ':', 1) AS int);
minute_str := split_part(time_24h, ':', 2);

IF hour_int >= 12 THEN
period := 'PM';
ELSE
period := 'AM';
END IF;

IF hour_int = 0 THEN
formatted_hour := 12;
ELSIF hour_int > 12 THEN
formatted_hour := hour_int - 12;
ELSE
formatted_hour := hour_int;
END IF;

RETURN format('%s:%s %s', formatted_hour, minute_str, period);
END;
$$;


ALTER FUNCTION "public"."format_time_12h"("time_24h" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_alerts_for_new_pet"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    pet_age_weeks integer;
    pet_species text;
    alert_data jsonb;
BEGIN
    BEGIN
        -- Get pet species safely
        pet_species := COALESCE(NEW.species, 'dog');
        
        -- Calculate age in weeks using our improved function
        -- Convert the NEW record to jsonb for the function
        alert_data := jsonb_build_object(
            'age', COALESCE(NEW.age, 1),
            'age_display', COALESCE(NEW.age_display, jsonb_build_object('value', COALESCE(NEW.age, 1), 'unit', 'years')),
            'species', pet_species,
            'created_at', NEW.created_at
        );
        
        pet_age_weeks := calculate_pet_age_weeks(alert_data);
        
        RAISE NOTICE 'Calculated age for pet %: % weeks', NEW.name, pet_age_weeks;
        
        -- Generate vaccination alerts based on age and species
        IF pet_age_weeks < 16 THEN
            -- Puppy/kitten - generate initial vaccination alerts
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
            -- Adult pet - generate annual checkup alert
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
        
        -- Generate deworming alert for all pets
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
        -- Log the error but don't fail the pet creation
        RAISE WARNING 'Error generating alerts for new pet %: % - %', NEW.name, SQLSTATE, SQLERRM;
        -- Continue with pet creation even if alert generation fails
    END;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_alerts_for_new_pet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('invoice_sequence')::text, 6, '0');
END;
$$;


ALTER FUNCTION "public"."generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_medical_alerts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
alert_date := alert_date - INTERVAL '3 days'; -- 3 days before for deworming

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
$$;


ALTER FUNCTION "public"."generate_medical_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_date TEXT;
v_seq INTEGER;
v_order_number TEXT;
BEGIN
v_date := to_char(CURRENT_DATE, 'YYYYMMDD');

SELECT COUNT(*) + 1 INTO v_seq
FROM orders
WHERE DATE(created_at) = CURRENT_DATE;

v_order_number := 'ORD-' || v_date || '-' || LPAD(v_seq::TEXT, 3, '0');

RETURN v_order_number;
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
INSERT INTO public.profiles (
id, 
email, 
display_name, 
is_owner, 
is_partner, 
email_confirmed,
email_confirmed_at,
onboarding_completed,
followers,
following,
created_at,
updated_at
)
VALUES (
NEW.id,
NEW.email,
COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
true,
false,
NEW.email_confirmed_at IS NOT NULL,
NEW.email_confirmed_at,
false,
ARRAY[]::text[],
ARRAY[]::text[],
NOW(),
NOW()
)
ON CONFLICT (id) DO NOTHING;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoke_webhook_edge_function"("order_id_param" "uuid", "event_type_param" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."invoke_webhook_edge_function"("order_id_param" "uuid", "event_type_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_payment_link_expired"("order_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."is_payment_link_expired"("order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_user_email_confirmed"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  confirmed boolean := false;
BEGIN
  SELECT email_confirmed INTO confirmed
  FROM profiles
  WHERE id = user_uuid;
  
  RETURN COALESCE(confirmed, false);
END;
$$;


ALTER FUNCTION "public"."is_user_email_confirmed"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_payment_as_failed"("order_id" "uuid", "reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
UPDATE orders
SET 
status = 'payment_failed',
updated_at = now()
WHERE id = order_id
AND status IN ('pending', 'payment_failed');
END;
$$;


ALTER FUNCTION "public"."mark_payment_as_failed"("order_id" "uuid", "reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_order_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_order_webhook"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_pet_share_accepted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
now(), -- Enviar inmediatamente
'pending'
);

RAISE NOTICE 'Notification created for pet share acceptance: % accepted by %', pet_name_text, shared_user_name_text;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_pet_share_accepted"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_pet_share_accepted"() IS 'Crea notificación con deep link cuando se acepta una invitación';



CREATE OR REPLACE FUNCTION "public"."notify_pet_share_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_pet_share_created"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_pet_share_created"() IS 'Crea notificación con deep link cuando se comparte una mascota';



CREATE OR REPLACE FUNCTION "public"."restore_stock_on_order_cancel"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."restore_stock_on_order_cancel"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_stock_on_order_cancel"() IS 'Restaura automáticamente el stock cuando una orden se CANCELA. El campo updated_at se actualiza automáticamente por su propio trigger.';



CREATE OR REPLACE FUNCTION "public"."send_medical_notifications"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  alert_record RECORD;
  user_profile RECORD;
BEGIN
  -- Buscar alertas que necesitan notificación (7 días antes)
  FOR alert_record IN 
    SELECT ma.*, p.name as pet_name, p.species
    FROM medical_alerts ma
    JOIN pets p ON p.id = ma.pet_id
    WHERE ma.status = 'pending'
    AND ma.due_date <= CURRENT_DATE + INTERVAL '7 days'
    AND ma.due_date > CURRENT_DATE
    AND ma.notification_sent = false
  LOOP
    -- Obtener perfil del usuario para verificar preferencias de notificación
    SELECT * INTO user_profile 
    FROM profiles 
    WHERE id = alert_record.user_id;
    
    IF FOUND AND user_profile.notification_preferences->>'push' = 'true' AND user_profile.push_token IS NOT NULL THEN
      -- Aquí se enviaría la notificación push
      -- Por ahora solo marcamos como enviada
      UPDATE medical_alerts 
      SET notification_sent = true, notification_sent_at = now()
      WHERE id = alert_record.id;
      
      -- Log para debugging
      RAISE NOTICE 'Notification sent for alert: % to user: %', alert_record.title, user_profile.display_name;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."send_medical_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_order_confirmation_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  supabase_url text;
  supabase_service_key text;
  function_url text;
  payload jsonb;
  request_id bigint;
  customer_email_text text;
  customer_name_text text;
  delivery_address_text text;
  payment_method_display text;
  template_to_use text;
  email_data jsonb;
BEGIN
  -- Log de inicio del trigger
  RAISE NOTICE '🚀 TRIGGER STARTED for order: %, operation: %, payment_status: % -> %', 
    NEW.id, TG_OP, COALESCE(OLD.payment_status, 'NULL'), NEW.payment_status;

  -- Solo enviar para pagos confirmados
  IF NEW.payment_status NOT IN ('paid', 'approved') THEN
    RAISE NOTICE '⏸️ SKIPPED: Payment status is not paid/approved: %', NEW.payment_status;
    RETURN NEW;
  END IF;

  -- No enviar si ya se había enviado antes (evitar duplicados en UPDATE)
  IF TG_OP = 'UPDATE' AND OLD.payment_status IN ('paid', 'approved') THEN
    RAISE NOTICE '⏸️ SKIPPED: Payment was already confirmed (OLD status: %)', OLD.payment_status;
    RETURN NEW;
  END IF;

  -- No enviar para servicios gratuitos
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE '⏸️ SKIPPED: Free service order: %', NEW.id;
    RETURN NEW;
  END IF;

  RAISE NOTICE '✅ VALIDATION PASSED: Proceeding to send email...';

  -- Obtener email del cliente desde profiles
  RAISE NOTICE '🔍 Looking for customer: %', NEW.customer_id;
  
  SELECT 
    p.email,
    COALESCE(p.display_name, p.email)
  INTO customer_email_text, customer_name_text
  FROM profiles p
  WHERE p.id = NEW.customer_id;

  IF customer_email_text IS NULL THEN
    RAISE WARNING '❌ No email found for customer %', NEW.customer_id;
    RETURN NEW;
  END IF;

  RAISE NOTICE '✅ Customer found: % <%>', customer_name_text, customer_email_text;

  -- Configuración de Supabase
  supabase_url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
  function_url := supabase_url || '/functions/v1/send-invoice-email';
  supabase_service_key := 'REDACTED_CREDENTIAL';

  -- Determinar el template y datos según el tipo de orden
  IF NEW.order_type = 'service_booking' THEN
    -- Template para reservas de servicios (agenda)
    template_to_use := 'agenda_confirmation';
    
    RAISE NOTICE '📅 Service booking detected - using agenda_confirmation template';
    
    email_data := jsonb_build_object(
      'client_name', customer_name_text,
      'order_number', COALESCE(NEW.order_number, '#' || RIGHT(NEW.id::text, 6)),
      'service_name', COALESCE(NEW.service_name, 'Servicio'),
      'provider_name', COALESCE(NEW.partner_name, 'Proveedor'),
      'reservation_date', COALESCE(TO_CHAR(NEW.appointment_date, 'DD/MM/YYYY'), 'Fecha no especificada'),
      'reservation_time', COALESCE(NEW.appointment_time, 'N/A'),
      'pet_name', COALESCE(NEW.pet_name, 'Mascota')
    );
  ELSE
    -- Template para compras de productos (tienda)
    template_to_use := 'shop_confirmation';
    
    RAISE NOTICE '🛍️ Product purchase detected - using shop_confirmation template';
    
    -- Obtener dirección de envío
    delivery_address_text := COALESCE(NEW.shipping_address, 'Sin dirección especificada');

    -- Formatear método de pago para mostrar
    payment_method_display := CASE 
      WHEN NEW.payment_method = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.payment_method = 'cash' THEN 'Efectivo'
      WHEN NEW.payment_method = 'card' THEN 'Tarjeta'
      ELSE INITCAP(NEW.payment_method)
    END;
    
    email_data := jsonb_build_object(
      'client_name', customer_name_text,
      'order_number', COALESCE(NEW.order_number, '#' || RIGHT(NEW.id::text, 6)),  -- Usar order_number si existe, sino últimos 6 del UUID
      'order_date', TO_CHAR(NEW.created_at, 'DD/MM/YYYY'),
      'payment_method', payment_method_display,
      'payment_status', 'Confirmada',
      'delivery_address', delivery_address_text
    );
  END IF;

  -- Preparar payload para el correo con estructura correcta
  payload := jsonb_build_object(
    'template_name', template_to_use,
    'recipient_email', customer_email_text,
    'order_id', NEW.id::text,
    'wait_for_invoice', true,
    'data', email_data
  );

  -- Enviar correo a través de la Edge Function send-email
  RAISE NOTICE '📤 Sending HTTP request to: %', function_url;
  RAISE NOTICE '📦 Payload: %', payload::text;
  
  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := payload,
      timeout_milliseconds := 15000  -- 15 segundos timeout
    ) INTO request_id;

    RAISE NOTICE '✅ HTTP request queued successfully (request_id: %)', request_id;
    RAISE NOTICE '📧 Order confirmation email queued for order % to %', 
      NEW.id, customer_email_text;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ EXCEPTION in HTTP request: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING '❌ Failed to send confirmation email for order %', NEW.id;
    -- No fallar el trigger completo si el email falla
  END;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."send_order_confirmation_email"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_order_confirmation_email"() IS 'Envía correo de confirmación al cliente cuando el pago de la orden es confirmado (payment_status = paid/approved)';



CREATE OR REPLACE FUNCTION "public"."set_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.order_number IS NULL THEN
NEW.order_number := generate_order_number();
END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_booking_status_on_order_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
IF OLD.status IS DISTINCT FROM NEW.status OR 
OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN

UPDATE bookings
SET 
status = NEW.status,
payment_status = NEW.payment_status,
payment_method = COALESCE(bookings.payment_method, NEW.payment_method),
payment_id = COALESCE(bookings.payment_id, NEW.payment_id),
payment_data = COALESCE(bookings.payment_data, NEW.payment_data),
payment_confirmed_at = CASE 
WHEN NEW.status = 'confirmed' AND bookings.payment_confirmed_at IS NULL 
THEN NEW.updated_at 
ELSE bookings.payment_confirmed_at 
END,
updated_at = NOW()
WHERE id = NEW.booking_id;

END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_booking_status_on_order_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_crm_and_accounting_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  event_type text;
  function_url text;
  accounting_function_url text;
  supabase_url text;
  supabase_service_key text;
  payload jsonb;
  accounting_payload jsonb;
  request_id bigint;
  accounting_request_id bigint;
  has_significant_changes boolean := false;
  should_send_to_accounting boolean := false;
  status_changed boolean := false;
  payment_status_changed boolean := false;
BEGIN
  IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
    RAISE NOTICE 'Skipping webhooks for free order: %', NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    event_type := 'order.created';
    has_significant_changes := true;

    IF NEW.payment_status IN ('paid', 'approved') THEN
      should_send_to_accounting := true;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    status_changed := NEW.status IS DISTINCT FROM OLD.status;
    payment_status_changed := NEW.payment_status IS DISTINCT FROM OLD.payment_status;

    has_significant_changes :=
      status_changed OR
      payment_status_changed OR
      NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
      NEW.items::text IS DISTINCT FROM OLD.items::text OR
      NEW.shipping_address::text IS DISTINCT FROM OLD.shipping_address::text;

    IF NOT has_significant_changes THEN
      RAISE NOTICE 'No significant changes for order %, skipping webhook', NEW.id;
      RETURN NEW;
    END IF;

    IF status_changed THEN
      IF NEW.status = 'cancelled' THEN
        event_type := 'order.cancelled';
      ELSIF NEW.status = 'confirmed' THEN
        event_type := 'order.confirmed';
      ELSIF NEW.status = 'completed' THEN
        event_type := 'order.completed';
      ELSE
        event_type := 'order.updated';
      END IF;
    ELSIF payment_status_changed THEN
      event_type := 'order.payment_updated';
    ELSE
      event_type := 'order.updated';
    END IF;

    IF payment_status_changed
       AND NEW.payment_status IN ('paid', 'approved')
       AND (OLD.payment_status IS NULL OR OLD.payment_status NOT IN ('paid', 'approved')) THEN
      should_send_to_accounting := true;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  supabase_url := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
  function_url := supabase_url || '/functions/v1/send-order-to-crm';
  accounting_function_url := supabase_url || '/functions/v1/send-order-to-accounting';
  supabase_service_key := 'REDACTED_CREDENTIAL';

  payload := jsonb_build_object(
    'order_id', NEW.id,
    'event_type', event_type
  );

  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := payload,
      timeout_milliseconds := 30000
    ) INTO request_id;

    RAISE NOTICE 'CRM webhook [%] queued for order % (request_id: %)', event_type, NEW.id, request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed CRM webhook for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
  END;

  IF should_send_to_accounting THEN
    accounting_payload := jsonb_build_object('order_id', NEW.id);

    BEGIN
      SELECT net.http_post(
        url := accounting_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_service_key
        ),
        body := accounting_payload,
        timeout_milliseconds := 30000
      ) INTO accounting_request_id;

      RAISE NOTICE 'Accounting webhook queued for order % (request_id: %)', NEW.id, accounting_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed Accounting webhook for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_crm_and_accounting_webhook"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_crm_and_accounting_webhook"() IS 'Reaplicado: detecta cambios múltiples y dispara contabilidad al confirmar pago.';



CREATE OR REPLACE FUNCTION "public"."trigger_crm_webhook"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
event_type text;
function_url text;
supabase_url text;
supabase_service_key text;
payload jsonb;
request_id bigint;
has_significant_changes boolean := false;
BEGIN
INSERT INTO crm_webhook_debug_logs (order_id, operation, old_status, new_status, message)
VALUES (NEW.id, TG_OP, OLD.status, NEW.status, 'Trigger ejecutado');

IF NEW.payment_method = 'free' OR NEW.total_amount = 0 THEN
INSERT INTO crm_webhook_debug_logs (order_id, operation, message)
VALUES (NEW.id, TG_OP, 'Orden gratuita - webhook omitido');
RAISE NOTICE 'Skipping CRM webhook for free service order: %', NEW.id;
RETURN NEW;
END IF;

IF TG_OP = 'INSERT' THEN
event_type := 'order.created';
has_significant_changes := true;

ELSIF TG_OP = 'UPDATE' THEN
INSERT INTO crm_webhook_debug_logs (order_id, operation, old_status, new_status, message)
VALUES (NEW.id, 'UPDATE', OLD.status, NEW.status, 'Verificando cambios significativos');

IF NEW.status IS DISTINCT FROM OLD.status THEN
has_significant_changes := true;

IF NEW.status = 'cancelled' THEN
event_type := 'order.cancelled';
ELSIF NEW.status = 'confirmed' THEN
event_type := 'order.confirmed';
ELSIF NEW.status = 'completed' THEN
event_type := 'order.completed';
ELSE
event_type := 'order.updated';
END IF;

INSERT INTO crm_webhook_debug_logs (order_id, operation, old_status, new_status, has_significant_changes, event_type, message)
VALUES (NEW.id, 'UPDATE', OLD.status, NEW.status, true, event_type, 'Status cambió');

ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
has_significant_changes := true;
event_type := 'order.payment_updated';

INSERT INTO crm_webhook_debug_logs (order_id, operation, has_significant_changes, event_type, message)
VALUES (NEW.id, 'UPDATE', true, event_type, 'Payment status cambió');

ELSIF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
has_significant_changes := true;
event_type := 'order.updated';

ELSIF NEW.items::text IS DISTINCT FROM OLD.items::text THEN
has_significant_changes := true;
event_type := 'order.updated';

ELSIF NEW.shipping_address::text IS DISTINCT FROM OLD.shipping_address::text THEN
has_significant_changes := true;
event_type := 'order.updated';

ELSE
has_significant_changes := false;

INSERT INTO crm_webhook_debug_logs (order_id, operation, has_significant_changes, message)
VALUES (NEW.id, 'UPDATE', false, 'No hay cambios significativos');
END IF;

IF NOT has_significant_changes THEN
RAISE NOTICE 'No significant changes for order %, skipping webhook', NEW.id;
RETURN NEW;
END IF;

ELSE
RETURN NEW;
END IF;

supabase_url := 'https://zkgiwamycbjcogcgqhff.supabase.co';
function_url := supabase_url || '/functions/v1/send-order-to-crm';

supabase_service_key := 'REDACTED_CREDENTIAL';

payload := jsonb_build_object(
'order_id', NEW.id,
'event_type', event_type
);

BEGIN
SELECT net.http_post(
url := function_url,
headers := jsonb_build_object(
'Content-Type', 'application/json',
'Authorization', 'Bearer ' || supabase_service_key
),
body := payload
) INTO request_id;

INSERT INTO crm_webhook_debug_logs (order_id, operation, event_type, message)
VALUES (NEW.id, TG_OP, event_type, 'Webhook encolado - request_id: ' || request_id);

RAISE NOTICE 'CRM webhook [%] queued for order % (request_id: %)', event_type, NEW.id, request_id;

EXCEPTION WHEN OTHERS THEN
INSERT INTO crm_webhook_debug_logs (order_id, operation, event_type, message)
VALUES (NEW.id, TG_OP, event_type, 'ERROR: ' || SQLERRM);

RAISE WARNING 'Failed to send CRM webhook notification for order %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
END;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_crm_webhook"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_crm_webhook"() IS 'Dispara webhooks al CRM solo para cambios significativos. Incluye logs detallados para debugging.';



CREATE OR REPLACE FUNCTION "public"."trigger_generate_alerts_new_pet"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- This function is now just a wrapper to the main function
    PERFORM generate_alerts_for_new_pet();
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Don't let trigger errors prevent pet creation
    RAISE NOTICE 'Alert generation failed, but pet creation continues: %', SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_generate_alerts_new_pet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_generate_medical_alerts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Generar alertas para la mascota cuando se agrega un nuevo registro médico
  PERFORM generate_medical_alerts(NEW.pet_id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_generate_medical_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_webhook_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."trigger_webhook_notification"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_webhook_notification"() IS '[DESACTIVADO] Función de webhook antiguo que enviaba a webhook_subscriptions. Los triggers fueron removidos. Sistema activo: trigger_crm_webhook()';



CREATE OR REPLACE FUNCTION "public"."update_adoption_chat_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_adoption_chat_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_alert_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Mark related alerts as completed when a new health record is added
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
$$;


ALTER FUNCTION "public"."update_alert_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_app_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_app_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_booking_tokens_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_booking_tokens_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_chatbot_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
UPDATE chatbot_conversations
SET last_message_at = NEW.created_at
WHERE id = NEW.conversation_id;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_chatbot_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE chat_conversations 
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_has_discount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Calcular si tiene descuento basado en discount_percentage o discount_amount
  NEW.has_discount := (
    (NEW.discount_percentage IS NOT NULL AND NEW.discount_percentage > 0) OR
    (NEW.discount_amount IS NOT NULL AND NEW.discount_amount > 0)
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_has_discount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_partner_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update partner rating and review count
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
$$;


ALTER FUNCTION "public"."update_partner_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pet_albums_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pet_albums_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pet_behavior_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pet_behavior_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pet_shares_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pet_shares_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_places_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_places_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_promotions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_promotions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_scheduled_notifications_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scheduled_notifications_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_message_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
UPDATE ai_chat_sessions
SET message_count = message_count + 1
WHERE id = NEW.session_id;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_session_message_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_webhook_subscription_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_webhook_subscription_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounting_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "response_status" integer,
    "response_body" "text",
    "attempt_number" integer DEFAULT 1,
    "success" boolean DEFAULT false,
    "accounting_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."accounting_webhook_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."accounting_webhook_logs" IS 'Registra todos los intentos de webhook al sistema contable con sus respuestas y estado';



CREATE TABLE IF NOT EXISTS "public"."admin_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adoption_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "pet_name" "text" NOT NULL,
    "partner_name" "text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "adoption_chats_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'adopted'::"text"])))
);


ALTER TABLE "public"."adoption_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adoption_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_name" "text" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."adoption_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adoption_pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid",
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "breed" "text" NOT NULL,
    "gender" "text" NOT NULL,
    "age" integer NOT NULL,
    "age_unit" "text" DEFAULT 'years'::"text" NOT NULL,
    "size" "text" NOT NULL,
    "weight" numeric,
    "color" "text",
    "description" "text" NOT NULL,
    "is_vaccinated" boolean DEFAULT false,
    "vaccines" "text"[],
    "is_dewormed" boolean DEFAULT false,
    "is_neutered" boolean DEFAULT false,
    "health_condition" "text",
    "last_vet_visit" "text",
    "temperament" "text"[],
    "good_with_dogs" boolean,
    "good_with_cats" boolean,
    "good_with_kids" boolean,
    "energy_level" "text",
    "special_needs" "text",
    "adoption_requirements" "text"[],
    "adoption_fee" numeric DEFAULT 0,
    "adoption_zones" "text",
    "contact_info" "text",
    "adoption_process" "text",
    "images" "text"[],
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "adoption_pets_age_unit_check" CHECK (("age_unit" = ANY (ARRAY['years'::"text", 'months'::"text", 'days'::"text"]))),
    CONSTRAINT "adoption_pets_energy_level_check" CHECK (("energy_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "adoption_pets_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "adoption_pets_size_check" CHECK (("size" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text"]))),
    CONSTRAINT "adoption_pets_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."adoption_pets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "audio_used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ai_chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."ai_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_chat_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "message_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ai_chat_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."allergies_ai_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "breed" "text" NOT NULL,
    "age_in_months" integer NOT NULL,
    "weight" numeric,
    "allergies" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cache_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    CONSTRAINT "allergies_ai_cache_age_in_months_check" CHECK (("age_in_months" >= 0)),
    CONSTRAINT "allergies_ai_cache_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text"]))),
    CONSTRAINT "allergies_ai_cache_weight_check" CHECK (("weight" > (0)::numeric))
);


ALTER TABLE "public"."allergies_ai_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."allergies_ai_cache" IS 'Caché de recomendaciones de alergias generadas por IA basadas en especie, raza y edad';



COMMENT ON COLUMN "public"."allergies_ai_cache"."allergies" IS 'Array JSON de alergias con estructura: [{name, description, allergy_type, symptoms, severity, frequency, triggers, prevention_tips}]';



COMMENT ON COLUMN "public"."allergies_ai_cache"."cache_key" IS 'Formato: {species}_{breed}_{age}_{weight}';



CREATE TABLE IF NOT EXISTS "public"."allergies_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "is_common" boolean DEFAULT false,
    "common_symptoms" "text"[] DEFAULT '{}'::"text"[],
    "common_triggers" "text"[] DEFAULT '{}'::"text"[],
    "avoidance_tips" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "allergies_catalog_category_check" CHECK (("category" = ANY (ARRAY['food'::"text", 'environmental'::"text", 'contact'::"text", 'medication'::"text", 'flea'::"text", 'other'::"text"]))),
    CONSTRAINT "allergies_catalog_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."allergies_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "success" boolean DEFAULT true,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_confirmation_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "email_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."booking_confirmation_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_confirmation_tokens" IS 'Tokens de confirmación para reservas de servicios sin costo';



COMMENT ON COLUMN "public"."booking_confirmation_tokens"."order_id" IS 'ID de la orden/reserva asociada';



COMMENT ON COLUMN "public"."booking_confirmation_tokens"."token_hash" IS 'Token único para confirmar la reserva';



COMMENT ON COLUMN "public"."booking_confirmation_tokens"."email_sent_at" IS 'Timestamp de cuándo se envió el email de confirmación';



COMMENT ON COLUMN "public"."booking_confirmation_tokens"."confirmed_at" IS 'Timestamp de cuándo se confirmó la reserva';



COMMENT ON COLUMN "public"."booking_confirmation_tokens"."expires_at" IS 'Timestamp de cuándo expira el token';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "service_name" "text" NOT NULL,
    "service_duration" integer,
    "partner_name" "text",
    "customer_id" "uuid" NOT NULL,
    "customer_name" "text",
    "customer_phone" "text",
    "pet_id" "uuid" NOT NULL,
    "pet_name" "text",
    "date" timestamp with time zone NOT NULL,
    "time" "text",
    "end_time" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "total_amount" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_email" "text",
    "payment_confirmed_at" timestamp with time zone,
    "payment_method" "text",
    "payment_status" "text",
    "payment_transaction_id" "text",
    "commission_amount" numeric(10,2) DEFAULT 0,
    "partner_amount" numeric(10,2) DEFAULT 0,
    "commission_percentage" numeric(5,2) DEFAULT 5.0,
    "payment_preference_id" "text",
    "payment_id" "text",
    "payment_data" "jsonb",
    "boarding_category" "text",
    "end_date" "date",
    "payment_link" "text",
    "order_number" "text",
    CONSTRAINT "bookings_commission_amount_check" CHECK (("commission_amount" >= (0)::numeric)),
    CONSTRAINT "bookings_commission_percentage_check" CHECK ((("commission_percentage" >= (0)::numeric) AND ("commission_percentage" <= (100)::numeric))),
    CONSTRAINT "bookings_partner_amount_check" CHECK (("partner_amount" >= (0)::numeric))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."customer_phone" IS 'Teléfono de contacto del cliente';



COMMENT ON COLUMN "public"."bookings"."customer_email" IS 'Email del cliente que realizó la reserva';



COMMENT ON COLUMN "public"."bookings"."payment_confirmed_at" IS 'Timestamp de cuando se confirmó el pago de la reserva';



COMMENT ON COLUMN "public"."bookings"."payment_method" IS 'Método de pago utilizado para la reserva (credit_card, debit_card, etc.)';



COMMENT ON COLUMN "public"."bookings"."payment_status" IS 'Estado del pago: pending, approved, rejected, cancelled';



COMMENT ON COLUMN "public"."bookings"."payment_transaction_id" IS 'ID de transacción del pago para seguimiento';



COMMENT ON COLUMN "public"."bookings"."commission_amount" IS 'Monto de comisión que recibe DogCatiFy';



COMMENT ON COLUMN "public"."bookings"."partner_amount" IS 'Monto que recibe el partner después de descontar comisión';



COMMENT ON COLUMN "public"."bookings"."commission_percentage" IS 'Porcentaje de comisión aplicado (0-100)';



COMMENT ON COLUMN "public"."bookings"."payment_preference_id" IS 'ID de la preferencia de pago en Mercado Pago';



COMMENT ON COLUMN "public"."bookings"."payment_id" IS 'ID del pago procesado en Mercado Pago';



COMMENT ON COLUMN "public"."bookings"."payment_data" IS 'Datos completos del pago desde Mercado Pago';



COMMENT ON COLUMN "public"."bookings"."boarding_category" IS 'Categoría de hospedaje: Diario, Nocturno, Fin de semana, Semanal';



COMMENT ON COLUMN "public"."bookings"."end_date" IS 'Fecha de finalización para reservas de pensión de múltiples días';



CREATE TABLE IF NOT EXISTS "public"."business_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "max_slots" integer DEFAULT 8,
    "slot_duration" integer DEFAULT 60,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "adoption_pet_id" "uuid",
    "partner_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."chat_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "message" "text" NOT NULL,
    "message_type" "text" DEFAULT 'text'::"text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chatbot_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visitor_name" "text",
    "visitor_email" "text",
    "status" "text" DEFAULT 'bot'::"text" NOT NULL,
    "assigned_agent_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "rating" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "chatbot_conversations_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "chatbot_conversations_status_check" CHECK (("status" = ANY (ARRAY['bot'::"text", 'waiting_agent'::"text", 'with_agent'::"text", 'resolved'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."chatbot_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chatbot_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_id" "uuid",
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "chatbot_messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['visitor'::"text", 'bot'::"text", 'agent'::"text"])))
);


ALTER TABLE "public"."chatbot_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_id" "uuid",
    "likes" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_webhook_debug_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "operation" "text",
    "old_status" "text",
    "new_status" "text",
    "has_significant_changes" boolean,
    "event_type" "text",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_webhook_debug_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "response_status" integer,
    "response_body" "text",
    "attempt_number" integer DEFAULT 1,
    "success" boolean DEFAULT false,
    "crm_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_webhook_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."crm_webhook_logs" IS 'Registra todos los intentos de envío de webhooks al CRM externo para auditoría y debugging';



CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dewormers_ai_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "breed" "text",
    "age_in_months" integer,
    "weight" numeric(5,2),
    "recommendations" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    CONSTRAINT "dewormers_ai_cache_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text"])))
);


ALTER TABLE "public"."dewormers_ai_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dewormers_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "brand" "text",
    "active_ingredient" "text",
    "administration_method" "text" NOT NULL,
    "parasite_types" "text"[] DEFAULT '{}'::"text"[],
    "frequency" "text",
    "age_recommendation" "text",
    "prescription_required" boolean DEFAULT false,
    "common_side_effects" "text"[] DEFAULT '{}'::"text"[],
    "contraindications" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dewormers_catalog_administration_method_check" CHECK (("administration_method" = ANY (ARRAY['oral'::"text", 'topical'::"text", 'injection'::"text", 'chewable'::"text"]))),
    CONSTRAINT "dewormers_catalog_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."dewormers_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deworming_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "age_weeks_min" integer NOT NULL,
    "age_weeks_max" integer,
    "frequency_weeks" integer NOT NULL,
    "parasite_types" "text"[] DEFAULT '{}'::"text"[],
    "recommended_products" "text"[] DEFAULT '{}'::"text"[],
    "priority" integer DEFAULT 1,
    "description" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "deworming_schedules_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."deworming_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_confirmations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "type" "text" NOT NULL,
    "is_confirmed" boolean DEFAULT false NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    CONSTRAINT "email_confirmations_type_check" CHECK (("type" = ANY (ARRAY['signup'::"text", 'password_reset'::"text"])))
);


ALTER TABLE "public"."email_confirmations" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_confirmations" IS 'Tokens de confirmación de email personalizados para registro y recuperación de contraseña';



COMMENT ON COLUMN "public"."email_confirmations"."user_id" IS 'Usuario asociado al token';



COMMENT ON COLUMN "public"."email_confirmations"."token_hash" IS 'Token único de confirmación';



COMMENT ON COLUMN "public"."email_confirmations"."type" IS 'Tipo de confirmación: signup o password_reset';



COMMENT ON COLUMN "public"."email_confirmations"."is_confirmed" IS 'Indica si el token ya fue usado';



COMMENT ON COLUMN "public"."email_confirmations"."expires_at" IS 'Fecha de expiración del token (24 horas)';



CREATE TABLE IF NOT EXISTS "public"."illnesses_ai_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "breed" "text" NOT NULL,
    "age_in_months" integer NOT NULL,
    "weight" numeric,
    "illnesses" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cache_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    CONSTRAINT "illnesses_ai_cache_age_in_months_check" CHECK (("age_in_months" >= 0)),
    CONSTRAINT "illnesses_ai_cache_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text"]))),
    CONSTRAINT "illnesses_ai_cache_weight_check" CHECK (("weight" > (0)::numeric))
);


ALTER TABLE "public"."illnesses_ai_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."illnesses_ai_cache" IS 'Caché de recomendaciones de enfermedades generadas por IA basadas en especie, raza y edad';



COMMENT ON COLUMN "public"."illnesses_ai_cache"."illnesses" IS 'Array JSON de enfermedades con estructura: [{name, description, category, symptoms, severity, is_contagious, affected_systems}]';



COMMENT ON COLUMN "public"."illnesses_ai_cache"."cache_key" IS 'Formato: {species}_{breed}_{age}_{weight}';



CREATE SEQUENCE IF NOT EXISTS "public"."invoice_sequence"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_sequence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "alert_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "related_record_id" "uuid",
    "notification_sent" boolean DEFAULT false,
    "notification_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "medical_alerts_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['vaccine'::"text", 'deworming'::"text", 'checkup'::"text", 'medication'::"text"]))),
    CONSTRAINT "medical_alerts_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "medical_alerts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'overdue'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "public"."medical_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_conditions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "common_symptoms" "text"[],
    "severity_levels" "text"[] DEFAULT ARRAY['Leve'::"text", 'Moderada'::"text", 'Severa'::"text", 'Crítica'::"text"],
    "is_chronic" boolean DEFAULT false,
    "is_contagious" boolean DEFAULT false,
    "prevention_tips" "text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "medical_conditions_category_check" CHECK (("category" = ANY (ARRAY['infectious'::"text", 'parasitic'::"text", 'genetic'::"text", 'behavioral'::"text", 'digestive'::"text", 'respiratory'::"text", 'skin'::"text", 'orthopedic'::"text", 'neurological'::"text", 'cardiac'::"text", 'urinary'::"text", 'reproductive'::"text", 'endocrine'::"text", 'oncological'::"text", 'other'::"text"]))),
    CONSTRAINT "medical_conditions_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."medical_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_history_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid" NOT NULL,
    "accessed_at" timestamp with time zone,
    "access_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."medical_history_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medical_treatments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "condition_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "dosage_info" "text",
    "duration_info" "text",
    "side_effects" "text"[],
    "contraindications" "text"[],
    "cost_range" "text",
    "is_prescription_required" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "medical_treatments_type_check" CHECK (("type" = ANY (ARRAY['medication'::"text", 'therapy'::"text", 'surgery'::"text", 'diet'::"text", 'lifestyle'::"text", 'supplement'::"text", 'topical'::"text", 'injection'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."medical_treatments" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."order_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."order_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "items" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "total_amount" numeric NOT NULL,
    "shipping_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_preference_id" "text",
    "payment_id" "text",
    "payment_method" "text" DEFAULT 'cash'::"text",
    "payment_status" "text",
    "payment_data" "jsonb",
    "commission_amount" numeric DEFAULT 0,
    "partner_amount" numeric DEFAULT 0,
    "partner_breakdown" "jsonb",
    "booking_id" "uuid",
    "order_type" "text" DEFAULT 'product_purchase'::"text",
    "service_id" "uuid",
    "appointment_date" timestamp with time zone,
    "appointment_time" "text",
    "pet_id" "uuid",
    "booking_notes" "text",
    "subtotal" numeric(10,2) DEFAULT 0,
    "iva_rate" numeric(5,2) DEFAULT 0,
    "iva_amount" numeric(10,2) DEFAULT 0,
    "iva_included_in_price" boolean DEFAULT false,
    "partner_name" "text",
    "service_name" "text",
    "pet_name" "text",
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "shipping_cost" numeric DEFAULT 0,
    "payment_link_expires_at" timestamp with time zone,
    "payment_retry_count" integer DEFAULT 0,
    "last_payment_url" "text",
    "payment_status_detail" "text",
    "order_number" "text",
    CONSTRAINT "orders_order_type_check" CHECK (("order_type" = ANY (ARRAY['product_purchase'::"text", 'service_booking'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'payment_failed'::"text", 'confirmed'::"text", 'preparing'::"text", 'processing'::"text", 'shipped'::"text", 'delivered'::"text", 'cancelled'::"text", 'insufficient_stock'::"text", 'reserved'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."total_amount" IS 'Total final: Si IVA incluido = subtotal. Si IVA no incluido = subtotal + iva_amount';



COMMENT ON COLUMN "public"."orders"."booking_id" IS 'ID de la reserva asociada (para service_booking)';



COMMENT ON COLUMN "public"."orders"."order_type" IS 'Tipo de orden: product_purchase o service_booking';



COMMENT ON COLUMN "public"."orders"."service_id" IS 'ID del servicio reservado (para service_booking)';



COMMENT ON COLUMN "public"."orders"."appointment_date" IS 'Fecha de la cita (para service_booking)';



COMMENT ON COLUMN "public"."orders"."appointment_time" IS 'Hora de la cita (para service_booking)';



COMMENT ON COLUMN "public"."orders"."pet_id" IS 'ID de la mascota para la cual es la reserva';



COMMENT ON COLUMN "public"."orders"."booking_notes" IS 'Notas adicionales de la reserva';



COMMENT ON COLUMN "public"."orders"."subtotal" IS 'Total sin IVA (base imponible)';



COMMENT ON COLUMN "public"."orders"."iva_rate" IS 'Porcentaje de IVA aplicado a esta orden';



COMMENT ON COLUMN "public"."orders"."iva_amount" IS 'Monto del IVA en esta orden';



COMMENT ON COLUMN "public"."orders"."iva_included_in_price" IS 'Si el IVA estaba incluido en los precios originales';



COMMENT ON COLUMN "public"."orders"."partner_name" IS 'Nombre del negocio/partner (veterinaria, peluquería, etc.)';



COMMENT ON COLUMN "public"."orders"."service_name" IS 'Nombre del servicio reservado (solo para order_type = service_booking)';



COMMENT ON COLUMN "public"."orders"."pet_name" IS 'Nombre de la mascota asociada a la orden';



COMMENT ON COLUMN "public"."orders"."customer_name" IS 'Nombre completo del cliente';



COMMENT ON COLUMN "public"."orders"."customer_email" IS 'Email del cliente';



COMMENT ON COLUMN "public"."orders"."customer_phone" IS 'Teléfono del cliente';



COMMENT ON COLUMN "public"."orders"."shipping_cost" IS 'Costo de envío para órdenes de productos. 0 para servicios sin envío.';



COMMENT ON COLUMN "public"."orders"."payment_link_expires_at" IS 'Fecha y hora en que expira el link de pago de Mercado Pago (típicamente 24h)';



COMMENT ON COLUMN "public"."orders"."payment_retry_count" IS 'Número de veces que el usuario ha reintentado el pago';



COMMENT ON COLUMN "public"."orders"."last_payment_url" IS 'URL del último intento de pago generado';



COMMENT ON COLUMN "public"."orders"."payment_status_detail" IS 'Detailed payment status from Mercado Pago (e.g., accredited, pending_contingency)';



COMMENT ON COLUMN "public"."orders"."order_number" IS 'CRM-generated order number returned after order.created webhook (e.g., DC-1763093357260)';



CREATE TABLE IF NOT EXISTS "public"."partner_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "price" numeric NOT NULL,
    "stock" integer DEFAULT 0,
    "brand" "text",
    "weight" "text",
    "size" "text",
    "color" "text",
    "age_range" "text",
    "pet_type" "text",
    "is_active" boolean DEFAULT true,
    "images" "text"[] DEFAULT '{}'::"text"[],
    "partner_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "iva_rate" numeric(5,2),
    "iva_included_in_price" boolean,
    "currency" "text" DEFAULT 'UYU'::"text" NOT NULL,
    "currency_code_dgi" "text" DEFAULT '858'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "partner_products_iva_rate_check" CHECK ((("iva_rate" >= (0)::numeric) AND ("iva_rate" <= (100)::numeric)))
);


ALTER TABLE "public"."partner_products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."partner_products"."iva_rate" IS 'Porcentaje de IVA del producto. Si NULL, hereda de partners.';



COMMENT ON COLUMN "public"."partner_products"."iva_included_in_price" IS 'Si el IVA está incluido. Si NULL, hereda de partners.';



COMMENT ON COLUMN "public"."partner_products"."currency" IS 'Código de moneda ISO 4217 (UYU, USD, EUR)';



COMMENT ON COLUMN "public"."partner_products"."currency_code_dgi" IS 'Código numérico de moneda según DGI Uruguay (858=UYU, 840=USD, 978=EUR)';



COMMENT ON COLUMN "public"."partner_products"."updated_at" IS 'Timestamp de última actualización del producto, se actualiza automáticamente';



CREATE TABLE IF NOT EXISTS "public"."partner_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "price" numeric NOT NULL,
    "duration" integer,
    "is_active" boolean DEFAULT true,
    "images" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "capacity_daily" integer,
    "capacity_overnight" integer,
    "capacity_weekend" integer,
    "capacity_weekly" integer,
    "pet_type" "text" DEFAULT 'both'::"text",
    "price_daily" numeric,
    "price_overnight" numeric,
    "price_weekend" numeric,
    "price_weekly" numeric,
    "iva_rate" numeric(5,2),
    "iva_included_in_price" boolean,
    "currency" "text" DEFAULT 'UYU'::"text" NOT NULL,
    "currency_code_dgi" "text" DEFAULT '858'::"text" NOT NULL,
    "has_cost" boolean DEFAULT true NOT NULL,
    "cancellation_hours" integer DEFAULT 24 NOT NULL,
    "confirmation_hours" integer,
    "place_id" "uuid",
    CONSTRAINT "partner_services_iva_rate_check" CHECK ((("iva_rate" >= (0)::numeric) AND ("iva_rate" <= (100)::numeric))),
    CONSTRAINT "partner_services_pet_type_check" CHECK (("pet_type" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."partner_services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."partner_services"."images" IS 'Array de URLs de imágenes del servicio';



COMMENT ON COLUMN "public"."partner_services"."capacity_daily" IS 'Capacidad máxima de mascotas para hospedaje diario';



COMMENT ON COLUMN "public"."partner_services"."capacity_overnight" IS 'Capacidad máxima de mascotas para hospedaje nocturno';



COMMENT ON COLUMN "public"."partner_services"."capacity_weekend" IS 'Capacidad máxima de mascotas para hospedaje de fin de semana';



COMMENT ON COLUMN "public"."partner_services"."capacity_weekly" IS 'Capacidad máxima de mascotas para hospedaje semanal';



COMMENT ON COLUMN "public"."partner_services"."pet_type" IS 'Tipo de mascota aceptada: dog (perros), cat (gatos), both (ambos)';



COMMENT ON COLUMN "public"."partner_services"."price_daily" IS 'Precio por día de hospedaje diario';



COMMENT ON COLUMN "public"."partner_services"."price_overnight" IS 'Precio por noche de hospedaje nocturno';



COMMENT ON COLUMN "public"."partner_services"."price_weekend" IS 'Precio por fin de semana';



COMMENT ON COLUMN "public"."partner_services"."price_weekly" IS 'Precio por semana';



COMMENT ON COLUMN "public"."partner_services"."iva_rate" IS 'Porcentaje de IVA específico del servicio. Si NULL, hereda de partners.';



COMMENT ON COLUMN "public"."partner_services"."iva_included_in_price" IS 'Si el IVA está incluido. Si NULL, hereda de partners.';



COMMENT ON COLUMN "public"."partner_services"."currency" IS 'Código de moneda ISO 4217 (UYU, USD, EUR)';



COMMENT ON COLUMN "public"."partner_services"."currency_code_dgi" IS 'Código numérico de moneda según DGI Uruguay (858=UYU, 840=USD, 978=EUR)';



COMMENT ON COLUMN "public"."partner_services"."has_cost" IS 'Indica si el servicio tiene costo (true) o es gratuito (false). Los servicios gratuitos crean reservas directamente sin pago.';



COMMENT ON COLUMN "public"."partner_services"."cancellation_hours" IS 'Horas previas para cancelar la cita (aplica a todos los servicios)';



COMMENT ON COLUMN "public"."partner_services"."confirmation_hours" IS 'Horas previas para confirmar reserva (solo servicios sin costo)';



CREATE TABLE IF NOT EXISTS "public"."partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" "text" NOT NULL,
    "business_type" "text" NOT NULL,
    "description" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "logo" "text",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "is_verified" boolean DEFAULT false,
    "rating" numeric DEFAULT 0,
    "reviews_count" integer DEFAULT 0,
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "mercadopago_connected" boolean DEFAULT false,
    "mercadopago_config" "jsonb" DEFAULT '{}'::"jsonb",
    "commission_percentage" numeric DEFAULT 5.0,
    "has_shipping" boolean DEFAULT false,
    "shipping_cost" numeric DEFAULT 0,
    "country_id" "uuid",
    "department_id" "uuid",
    "calle" "text",
    "numero" "text",
    "barrio" "text",
    "codigo_postal" "text",
    "latitud" "text",
    "longitud" "text",
    "iva_rate" numeric(5,2) DEFAULT 0,
    "iva_included_in_price" boolean DEFAULT false,
    "rut" "text",
    "approval_status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "partners_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "partners_iva_rate_check" CHECK ((("iva_rate" >= (0)::numeric) AND ("iva_rate" <= (100)::numeric)))
);


ALTER TABLE "public"."partners" OWNER TO "postgres";


COMMENT ON COLUMN "public"."partners"."country_id" IS 'Referencia al país donde se ubica el negocio';



COMMENT ON COLUMN "public"."partners"."department_id" IS 'Referencia al departamento/estado donde se ubica el negocio';



COMMENT ON COLUMN "public"."partners"."calle" IS 'Nombre de la calle donde se ubica el negocio';



COMMENT ON COLUMN "public"."partners"."numero" IS 'Número de la dirección del negocio';



COMMENT ON COLUMN "public"."partners"."barrio" IS 'Nombre del barrio donde se ubica el negocio';



COMMENT ON COLUMN "public"."partners"."codigo_postal" IS 'Código postal del negocio';



COMMENT ON COLUMN "public"."partners"."latitud" IS 'Coordenada GPS latitud del negocio';



COMMENT ON COLUMN "public"."partners"."longitud" IS 'Coordenada GPS longitud del negocio';



COMMENT ON COLUMN "public"."partners"."iva_rate" IS 'Porcentaje de IVA (ej: 21.00 para 21%)';



COMMENT ON COLUMN "public"."partners"."iva_included_in_price" IS 'Si true, el precio mostrado incluye IVA. Si false, el IVA se suma al precio.';



COMMENT ON COLUMN "public"."partners"."rut" IS 'RUT del negocio/empresa (formato flexible: 12345678-9)';



CREATE TABLE IF NOT EXISTS "public"."pet_albums" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "description" "text",
    "images" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_shared" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_albums" OWNER TO "postgres";


COMMENT ON COLUMN "public"."pet_albums"."images" IS 'Array de URLs de imágenes y videos. Videos tienen prefijo "VIDEO:" (ej: "VIDEO:https://.../video.mp4")';



COMMENT ON COLUMN "public"."pet_albums"."updated_at" IS 'Timestamp de última actualización del álbum, se actualiza automáticamente';



CREATE TABLE IF NOT EXISTS "public"."pet_behavior" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "traits" "jsonb" NOT NULL,
    "assessment_date" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_behavior" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_health" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "name" "text",
    "application_date" "text",
    "diagnosis_date" "text",
    "next_due_date" "text",
    "veterinarian" "text",
    "treatment" "text",
    "symptoms" "text",
    "severity" "text",
    "product_name" "text",
    "notes" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "weight" "text",
    "weight_unit" "text",
    "date" "text"
);


ALTER TABLE "public"."pet_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "shared_with_user_id" "uuid" NOT NULL,
    "permission_level" "text" DEFAULT 'view'::"text" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_self_share" CHECK (("owner_id" <> "shared_with_user_id")),
    CONSTRAINT "pet_shares_permission_level_check" CHECK (("permission_level" = ANY (ARRAY['view'::"text", 'edit'::"text", 'admin'::"text"]))),
    CONSTRAINT "pet_shares_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['veterinarian'::"text", 'family'::"text", 'friend'::"text", 'caretaker'::"text", 'other'::"text"]))),
    CONSTRAINT "pet_shares_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."pet_shares" OWNER TO "postgres";


COMMENT ON TABLE "public"."pet_shares" IS 'Almacena las relaciones de compartir mascotas entre usuarios';



COMMENT ON COLUMN "public"."pet_shares"."permission_level" IS 'Nivel de permiso: view (solo ver), edit (editar), admin (gestión completa)';



COMMENT ON COLUMN "public"."pet_shares"."relationship_type" IS 'Tipo de relación: veterinarian, family, friend, caretaker, other';



COMMENT ON COLUMN "public"."pet_shares"."status" IS 'Estado de la invitación: pending, accepted, rejected, revoked';



CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "breed" "text" NOT NULL,
    "breed_info" "jsonb",
    "age" numeric,
    "age_display" "jsonb",
    "gender" "text" NOT NULL,
    "weight" numeric,
    "weight_display" "jsonb",
    "is_neutered" boolean DEFAULT false,
    "has_chip" boolean DEFAULT false,
    "chip_number" "text",
    "photo_url" "text",
    "owner_id" "uuid" NOT NULL,
    "personality" "text"[] DEFAULT '{}'::"text"[],
    "medical_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "color" "text"
);


ALTER TABLE "public"."pets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."places" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "address" "text" NOT NULL,
    "phone" "text",
    "rating" numeric DEFAULT 5,
    "description" "text" NOT NULL,
    "pet_amenities" "text"[] DEFAULT '{}'::"text"[],
    "image_url" "text",
    "coordinates" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "images" "text"[],
    "partner_id" "uuid",
    CONSTRAINT "places_rating_check" CHECK ((("rating" >= (1)::numeric) AND ("rating" <= (5)::numeric)))
);


ALTER TABLE "public"."places" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pet_id" "uuid" NOT NULL,
    "content" "text",
    "image_url" "text",
    "album_images" "text"[] DEFAULT '{}'::"text"[],
    "likes" "text"[] DEFAULT '{}'::"text"[],
    "type" "text" DEFAULT 'single'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "author" "jsonb",
    "pet" "jsonb",
    "album_id" "uuid"
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."posts"."author" IS 'Información del autor del post en formato JSON';



COMMENT ON COLUMN "public"."posts"."pet" IS 'Información de la mascota del post en formato JSON';



COMMENT ON COLUMN "public"."posts"."album_id" IS 'Reference to pet_albums table for posts created from shared albums';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "photo_url" "text",
    "is_owner" boolean DEFAULT true,
    "is_partner" boolean DEFAULT false,
    "location" "text",
    "bio" "text",
    "phone" "text",
    "followers" "text"[] DEFAULT '{}'::"text"[],
    "following" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "favorite_products" "text"[] DEFAULT '{}'::"text"[],
    "push_token" "text",
    "notification_preferences" "jsonb" DEFAULT '{"push": true, "email": true}'::"jsonb",
    "biometric_enabled" boolean DEFAULT false,
    "biometric_enabled_at" timestamp with time zone,
    "email_confirmed" boolean DEFAULT false,
    "email_confirmed_at" timestamp with time zone,
    "country_id" "uuid",
    "department_id" "uuid",
    "calle" "text",
    "numero" "text",
    "barrio" "text",
    "codigo_postal" "text",
    "latitud" "text",
    "longitud" "text",
    "address_street" "text",
    "address_number" "text",
    "address_locality" "text",
    "address_department" "text",
    "address_phone" "text",
    "fcm_token" "text",
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "onboarding_completed_at" timestamp with time zone,
    "dotty_enabled" boolean DEFAULT true NOT NULL,
    "is_admin" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."push_token" IS 'Expo Push Token (ExponentPushToken[xxx]) - usado para Expo Push Service (API heredada)';



COMMENT ON COLUMN "public"."profiles"."notification_preferences" IS 'Preferencias de notificaciones del usuario en formato JSON';



COMMENT ON COLUMN "public"."profiles"."fcm_token" IS 'Firebase Cloud Messaging token nativo - usado para FCM API v1 en Android';



CREATE TABLE IF NOT EXISTS "public"."promotion_billing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promotion_id" "uuid",
    "partner_id" "uuid",
    "total_clicks" integer DEFAULT 0 NOT NULL,
    "cost_per_click" numeric(10,2) DEFAULT 100.00 NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "billing_period_start" timestamp with time zone NOT NULL,
    "billing_period_end" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invoice_number" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "paid_at" timestamp with time zone,
    "created_by" "uuid"
);


ALTER TABLE "public"."promotion_billing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "target_audience" "text" DEFAULT 'all'::"text",
    "is_active" boolean DEFAULT true,
    "views" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "partner_id" "uuid",
    "promotion_type" "text" DEFAULT 'general'::"text",
    "cta_text" "text" DEFAULT 'Más información'::"text",
    "cta_url" "text",
    "likes" "text"[] DEFAULT '{}'::"text"[],
    "discount_percentage" smallint,
    "discount_amount" numeric(10,2) DEFAULT NULL::numeric,
    "original_price" numeric(10,2) DEFAULT NULL::numeric,
    "discounted_price" numeric(10,2) DEFAULT NULL::numeric,
    "max_uses" integer,
    "current_uses" integer DEFAULT 0,
    "promo_code" "text",
    "minimum_purchase" numeric(10,2) DEFAULT NULL::numeric,
    "applicable_categories" "text"[] DEFAULT '{}'::"text"[],
    "applicable_products" "text"[] DEFAULT '{}'::"text"[],
    "priority" integer DEFAULT 5,
    "is_featured" boolean DEFAULT false,
    "banner_text" "text",
    "terms_conditions" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "has_discount" boolean DEFAULT false,
    CONSTRAINT "promotions_amounts_positive_check" CHECK (((("discount_amount" IS NULL) OR ("discount_amount" >= (0)::numeric)) AND (("original_price" IS NULL) OR ("original_price" >= (0)::numeric)) AND (("discounted_price" IS NULL) OR ("discounted_price" >= (0)::numeric)) AND (("minimum_purchase" IS NULL) OR ("minimum_purchase" >= (0)::numeric)))),
    CONSTRAINT "promotions_current_uses_check" CHECK ((("current_uses" >= 0) AND (("max_uses" IS NULL) OR ("current_uses" <= "max_uses")))),
    CONSTRAINT "promotions_discount_percentage_check" CHECK ((("discount_percentage" IS NULL) OR (("discount_percentage" >= 0) AND ("discount_percentage" <= 100)))),
    CONSTRAINT "promotions_max_uses_check" CHECK ((("max_uses" IS NULL) OR ("max_uses" > 0))),
    CONSTRAINT "promotions_priority_check" CHECK ((("priority" >= 1) AND ("priority" <= 10)))
);


ALTER TABLE "public"."promotions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."promotions"."discount_percentage" IS 'Porcentaje de descuento (0-100)';



COMMENT ON COLUMN "public"."promotions"."discount_amount" IS 'Monto fijo de descuento en moneda local';



COMMENT ON COLUMN "public"."promotions"."original_price" IS 'Precio original del producto/servicio';



COMMENT ON COLUMN "public"."promotions"."discounted_price" IS 'Precio final con descuento aplicado';



COMMENT ON COLUMN "public"."promotions"."max_uses" IS 'Máximo número de veces que se puede usar la promoción';



COMMENT ON COLUMN "public"."promotions"."current_uses" IS 'Número actual de usos de la promoción';



COMMENT ON COLUMN "public"."promotions"."promo_code" IS 'Código promocional único para aplicar descuento';



COMMENT ON COLUMN "public"."promotions"."minimum_purchase" IS 'Monto mínimo de compra requerido para aplicar la promoción';



COMMENT ON COLUMN "public"."promotions"."applicable_categories" IS 'Array de categorías donde aplica la promoción';



COMMENT ON COLUMN "public"."promotions"."applicable_products" IS 'Array de IDs de productos específicos donde aplica';



COMMENT ON COLUMN "public"."promotions"."priority" IS 'Prioridad de la promoción (1=baja, 10=alta)';



COMMENT ON COLUMN "public"."promotions"."is_featured" IS 'Indica si la promoción debe mostrarse como destacada';



COMMENT ON COLUMN "public"."promotions"."banner_text" IS 'Texto especial para mostrar en banners';



COMMENT ON COLUMN "public"."promotions"."terms_conditions" IS 'Términos y condiciones de la promoción';



COMMENT ON COLUMN "public"."promotions"."updated_at" IS 'Fecha y hora de la última actualización';



CREATE TABLE IF NOT EXISTS "public"."scheduled_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "reference_id" "uuid" NOT NULL,
    "reference_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "scheduled_for" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "scheduled_notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['booking_reminder'::"text", 'order_status_change'::"text", 'pet_share_request'::"text", 'pet_share_accepted'::"text", 'pet_share_invitation'::"text", 'booking_confirmation'::"text", 'vaccine_reminder_7days'::"text", 'vaccine_reminder_24hours'::"text", 'broadcast'::"text"]))),
    CONSTRAINT "scheduled_notifications_reference_type_check" CHECK (("reference_type" = ANY (ARRAY['booking'::"text", 'order'::"text", 'pet_share'::"text", 'pet_health'::"text", 'broadcast'::"text"]))),
    CONSTRAINT "scheduled_notifications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."scheduled_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "partner_id" "uuid",
    "service_id" "uuid",
    "customer_id" "uuid",
    "pet_id" "uuid",
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."service_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_monthly" numeric(10,2) NOT NULL,
    "price_yearly" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enabled" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."subscription_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatments_ai_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "illness_name" "text" NOT NULL,
    "age_in_months" integer NOT NULL,
    "weight" numeric,
    "treatments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "cache_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    CONSTRAINT "treatments_ai_cache_age_in_months_check" CHECK (("age_in_months" >= 0)),
    CONSTRAINT "treatments_ai_cache_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text"]))),
    CONSTRAINT "treatments_ai_cache_weight_check" CHECK (("weight" > (0)::numeric))
);


ALTER TABLE "public"."treatments_ai_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."treatments_ai_cache" IS 'Caché de recomendaciones de tratamientos generados por IA basados en enfermedad, especie y características de la mascota';



COMMENT ON COLUMN "public"."treatments_ai_cache"."treatments" IS 'Array JSON de tratamientos con estructura: [{name, description, type, requires_prescription, dosage, duration, side_effects}]';



COMMENT ON COLUMN "public"."treatments_ai_cache"."cache_key" IS 'Formato: {species}_{illness}_{age}_{weight}';



CREATE TABLE IF NOT EXISTS "public"."user_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "crm_subscription_id" "text",
    "started_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "billing_cycle" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vaccination_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "vaccine_name" "text" NOT NULL,
    "age_weeks_min" integer NOT NULL,
    "age_weeks_max" integer,
    "doses_required" integer DEFAULT 1,
    "interval_weeks" integer,
    "booster_interval_months" integer,
    "is_core" boolean DEFAULT true,
    "priority" integer DEFAULT 1,
    "description" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vaccination_schedules_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."vaccination_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vaccine_recommendations_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "age_range" "text" NOT NULL,
    "vaccines_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    CONSTRAINT "vaccine_recommendations_cache_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text"])))
);


ALTER TABLE "public"."vaccine_recommendations_cache" OWNER TO "postgres";


COMMENT ON TABLE "public"."vaccine_recommendations_cache" IS 'Cache de recomendaciones de vacunas generadas por IA para reducir llamadas a OpenAI';



COMMENT ON COLUMN "public"."vaccine_recommendations_cache"."age_range" IS 'Rango de edad en meses: 0-6, 6-12, 12-24, 24+';



COMMENT ON COLUMN "public"."vaccine_recommendations_cache"."vaccines_data" IS 'Array JSON con todas las vacunas y su información detallada';



CREATE TABLE IF NOT EXISTS "public"."vaccines_catalog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "is_required" boolean DEFAULT false,
    "frequency" "text",
    "age_recommendation" "text",
    "common_brands" "text"[] DEFAULT '{}'::"text"[],
    "side_effects" "text"[] DEFAULT '{}'::"text"[],
    "contraindications" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vaccines_catalog_species_check" CHECK (("species" = ANY (ARRAY['dog'::"text", 'cat'::"text", 'both'::"text"]))),
    CONSTRAINT "vaccines_catalog_type_check" CHECK (("type" = ANY (ARRAY['core'::"text", 'non_core'::"text", 'lifestyle'::"text"])))
);


ALTER TABLE "public"."vaccines_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."veterinary_clinics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "email" "text",
    "specialties" "text"[],
    "emergency_service" boolean DEFAULT false,
    "rating" numeric(2,1) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."veterinary_clinics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "webhook_subscription_id" "uuid",
    "order_id" "uuid",
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "response_status" integer,
    "response_body" "text",
    "attempt_number" integer DEFAULT 1,
    "success" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "webhook_url" "text" NOT NULL,
    "events" "jsonb" DEFAULT '["order.created", "order.updated", "order.cancelled"]'::"jsonb" NOT NULL,
    "secret_key" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_webhook_url" CHECK (("webhook_url" ~* '^https?://.*'::"text"))
);


ALTER TABLE "public"."webhook_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhook_subscriptions" IS 'Almacena suscripciones de webhooks para partners. partner_id referencia la tabla partners, no profiles.';



ALTER TABLE ONLY "public"."accounting_webhook_logs"
    ADD CONSTRAINT "accounting_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_settings"
    ADD CONSTRAINT "admin_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."admin_settings"
    ADD CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adoption_chats"
    ADD CONSTRAINT "adoption_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adoption_messages"
    ADD CONSTRAINT "adoption_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adoption_pets"
    ADD CONSTRAINT "adoption_pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_chat_messages"
    ADD CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_chat_sessions"
    ADD CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allergies_ai_cache"
    ADD CONSTRAINT "allergies_ai_cache_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."allergies_ai_cache"
    ADD CONSTRAINT "allergies_ai_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."allergies_catalog"
    ADD CONSTRAINT "allergies_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_confirmation_tokens"
    ADD CONSTRAINT "booking_confirmation_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_confirmation_tokens"
    ADD CONSTRAINT "booking_confirmation_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_schedule"
    ADD CONSTRAINT "business_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chatbot_conversations"
    ADD CONSTRAINT "chatbot_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chatbot_messages"
    ADD CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_webhook_debug_logs"
    ADD CONSTRAINT "crm_webhook_debug_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_webhook_logs"
    ADD CONSTRAINT "crm_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dewormers_ai_cache"
    ADD CONSTRAINT "dewormers_ai_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dewormers_catalog"
    ADD CONSTRAINT "dewormers_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deworming_schedules"
    ADD CONSTRAINT "deworming_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_confirmations"
    ADD CONSTRAINT "email_confirmations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_confirmations"
    ADD CONSTRAINT "email_confirmations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."illnesses_ai_cache"
    ADD CONSTRAINT "illnesses_ai_cache_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."illnesses_ai_cache"
    ADD CONSTRAINT "illnesses_ai_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_alerts"
    ADD CONSTRAINT "medical_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_conditions"
    ADD CONSTRAINT "medical_conditions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_history_tokens"
    ADD CONSTRAINT "medical_history_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."medical_history_tokens"
    ADD CONSTRAINT "medical_history_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."medical_treatments"
    ADD CONSTRAINT "medical_treatments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_products"
    ADD CONSTRAINT "partner_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_services"
    ADD CONSTRAINT "partner_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_albums"
    ADD CONSTRAINT "pet_albums_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_behavior"
    ADD CONSTRAINT "pet_behavior_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_health"
    ADD CONSTRAINT "pet_health_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_shares"
    ADD CONSTRAINT "pet_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotion_billing"
    ADD CONSTRAINT "promotion_billing_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."promotion_billing"
    ADD CONSTRAINT "promotion_billing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_notifications"
    ADD CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_settings"
    ADD CONSTRAINT "subscription_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatments_ai_cache"
    ADD CONSTRAINT "treatments_ai_cache_cache_key_key" UNIQUE ("cache_key");



ALTER TABLE ONLY "public"."treatments_ai_cache"
    ADD CONSTRAINT "treatments_ai_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_shares"
    ADD CONSTRAINT "unique_active_share" UNIQUE ("pet_id", "shared_with_user_id");



ALTER TABLE ONLY "public"."user_carts"
    ADD CONSTRAINT "user_carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vaccination_schedules"
    ADD CONSTRAINT "vaccination_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vaccine_recommendations_cache"
    ADD CONSTRAINT "vaccine_recommendations_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vaccine_recommendations_cache"
    ADD CONSTRAINT "vaccine_recommendations_cache_species_age_range_key" UNIQUE ("species", "age_range");



ALTER TABLE ONLY "public"."vaccines_catalog"
    ADD CONSTRAINT "vaccines_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."veterinary_clinics"
    ADD CONSTRAINT "veterinary_clinics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_subscriptions"
    ADD CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accounting_webhook_logs_created_at" ON "public"."accounting_webhook_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_accounting_webhook_logs_order_id" ON "public"."accounting_webhook_logs" USING "btree" ("order_id");



CREATE INDEX "idx_accounting_webhook_logs_success" ON "public"."accounting_webhook_logs" USING "btree" ("success");



CREATE INDEX "idx_admin_settings_key" ON "public"."admin_settings" USING "btree" ("key");



CREATE INDEX "idx_adoption_chats_customer_id" ON "public"."adoption_chats" USING "btree" ("customer_id");



CREATE INDEX "idx_adoption_chats_partner_id" ON "public"."adoption_chats" USING "btree" ("partner_id");



CREATE INDEX "idx_adoption_chats_status" ON "public"."adoption_chats" USING "btree" ("status");



CREATE INDEX "idx_adoption_messages_chat_id" ON "public"."adoption_messages" USING "btree" ("chat_id");



CREATE INDEX "idx_adoption_messages_created_at" ON "public"."adoption_messages" USING "btree" ("created_at");



CREATE INDEX "idx_adoption_pets_partner_available" ON "public"."adoption_pets" USING "btree" ("partner_id", "is_available");



CREATE INDEX "idx_ai_chat_messages_created_at" ON "public"."ai_chat_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_chat_messages_session_id" ON "public"."ai_chat_messages" USING "btree" ("session_id");



CREATE INDEX "idx_ai_chat_sessions_started_at" ON "public"."ai_chat_sessions" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_ai_chat_sessions_user_id" ON "public"."ai_chat_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_allergies_cache_key" ON "public"."allergies_ai_cache" USING "btree" ("cache_key");



CREATE INDEX "idx_allergies_expires_at" ON "public"."allergies_ai_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_allergies_species_breed" ON "public"."allergies_ai_cache" USING "btree" ("species", "breed");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_resource_type" ON "public"."audit_logs" USING "btree" ("resource_type");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_booking_tokens_email_sent" ON "public"."booking_confirmation_tokens" USING "btree" ("email_sent_at") WHERE ("email_sent_at" IS NULL);



CREATE INDEX "idx_booking_tokens_expires" ON "public"."booking_confirmation_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_booking_tokens_hash" ON "public"."booking_confirmation_tokens" USING "btree" ("token_hash");



CREATE INDEX "idx_booking_tokens_order_id" ON "public"."booking_confirmation_tokens" USING "btree" ("order_id");



CREATE INDEX "idx_bookings_customer_email" ON "public"."bookings" USING "btree" ("customer_email");



CREATE INDEX "idx_bookings_date_range" ON "public"."bookings" USING "btree" ("date", "end_date") WHERE ("status" = 'confirmed'::"text");



CREATE INDEX "idx_bookings_payment_confirmed_at" ON "public"."bookings" USING "btree" ("payment_confirmed_at");



CREATE INDEX "idx_bookings_payment_id" ON "public"."bookings" USING "btree" ("payment_id") WHERE ("payment_id" IS NOT NULL);



CREATE INDEX "idx_bookings_payment_method" ON "public"."bookings" USING "btree" ("payment_method");



CREATE INDEX "idx_bookings_payment_preference_id" ON "public"."bookings" USING "btree" ("payment_preference_id") WHERE ("payment_preference_id" IS NOT NULL);



CREATE INDEX "idx_bookings_payment_status" ON "public"."bookings" USING "btree" ("payment_status");



CREATE INDEX "idx_bookings_payment_transaction_id" ON "public"."bookings" USING "btree" ("payment_transaction_id");



CREATE INDEX "idx_bookings_service_category" ON "public"."bookings" USING "btree" ("service_id", "boarding_category") WHERE ("status" = 'confirmed'::"text");



CREATE INDEX "idx_chat_conversations_partner" ON "public"."chat_conversations" USING "btree" ("partner_id");



CREATE INDEX "idx_chat_conversations_user" ON "public"."chat_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_chat_messages_conversation" ON "public"."chat_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_chat_messages_unread" ON "public"."chat_messages" USING "btree" ("conversation_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_chatbot_conversations_agent" ON "public"."chatbot_conversations" USING "btree" ("assigned_agent_id");



CREATE INDEX "idx_chatbot_conversations_last_message" ON "public"."chatbot_conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_chatbot_conversations_status" ON "public"."chatbot_conversations" USING "btree" ("status");



CREATE INDEX "idx_chatbot_messages_conversation" ON "public"."chatbot_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_chatbot_messages_created" ON "public"."chatbot_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_crm_webhook_logs_created_at" ON "public"."crm_webhook_logs" USING "btree" ("created_at");



CREATE INDEX "idx_crm_webhook_logs_event_type" ON "public"."crm_webhook_logs" USING "btree" ("event_type");



CREATE INDEX "idx_crm_webhook_logs_order_id" ON "public"."crm_webhook_logs" USING "btree" ("order_id");



CREATE INDEX "idx_crm_webhook_logs_success" ON "public"."crm_webhook_logs" USING "btree" ("success");



CREATE INDEX "idx_departments_country_id" ON "public"."departments" USING "btree" ("country_id");



CREATE INDEX "idx_dewormers_cache_expires" ON "public"."dewormers_ai_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_dewormers_cache_lookup" ON "public"."dewormers_ai_cache" USING "btree" ("species", "breed", "age_in_months", "weight");



CREATE INDEX "idx_deworming_schedules_species" ON "public"."deworming_schedules" USING "btree" ("species", "age_weeks_min");



CREATE INDEX "idx_email_confirmations_expires_at" ON "public"."email_confirmations" USING "btree" ("expires_at");



CREATE INDEX "idx_email_confirmations_is_confirmed" ON "public"."email_confirmations" USING "btree" ("is_confirmed");



CREATE INDEX "idx_email_confirmations_token_hash" ON "public"."email_confirmations" USING "btree" ("token_hash");



CREATE INDEX "idx_email_confirmations_type" ON "public"."email_confirmations" USING "btree" ("type");



CREATE INDEX "idx_email_confirmations_type_confirmed" ON "public"."email_confirmations" USING "btree" ("type", "is_confirmed");



CREATE INDEX "idx_email_confirmations_user_id" ON "public"."email_confirmations" USING "btree" ("user_id");



CREATE INDEX "idx_illnesses_cache_key" ON "public"."illnesses_ai_cache" USING "btree" ("cache_key");



CREATE INDEX "idx_illnesses_expires_at" ON "public"."illnesses_ai_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_illnesses_species_breed" ON "public"."illnesses_ai_cache" USING "btree" ("species", "breed");



CREATE INDEX "idx_medical_alerts_due_date" ON "public"."medical_alerts" USING "btree" ("due_date", "status");



CREATE INDEX "idx_medical_alerts_pet_status" ON "public"."medical_alerts" USING "btree" ("pet_id", "status");



CREATE UNIQUE INDEX "idx_medical_alerts_unique_pending" ON "public"."medical_alerts" USING "btree" ("pet_id", "title", "due_date", "status") WHERE ("status" = 'pending'::"text");



COMMENT ON INDEX "public"."idx_medical_alerts_unique_pending" IS 'Prevents duplicate pending alerts for the same pet, condition, and due date';



CREATE INDEX "idx_medical_alerts_user_pending" ON "public"."medical_alerts" USING "btree" ("user_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_medical_conditions_category" ON "public"."medical_conditions" USING "btree" ("category", "species");



CREATE INDEX "idx_medical_conditions_species" ON "public"."medical_conditions" USING "btree" ("species", "is_active");



CREATE INDEX "idx_medical_history_tokens_expires_at" ON "public"."medical_history_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_medical_history_tokens_pet_id" ON "public"."medical_history_tokens" USING "btree" ("pet_id");



CREATE INDEX "idx_medical_history_tokens_token" ON "public"."medical_history_tokens" USING "btree" ("token");



CREATE INDEX "idx_medical_treatments_condition" ON "public"."medical_treatments" USING "btree" ("condition_id", "is_active");



CREATE INDEX "idx_orders_appointment_date" ON "public"."orders" USING "btree" ("appointment_date") WHERE ("appointment_date" IS NOT NULL);



CREATE INDEX "idx_orders_booking_id" ON "public"."orders" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_customer_email" ON "public"."orders" USING "btree" ("customer_email");



CREATE INDEX "idx_orders_customer_type" ON "public"."orders" USING "btree" ("customer_id", "order_type");



CREATE INDEX "idx_orders_iva" ON "public"."orders" USING "btree" ("iva_rate") WHERE ("iva_rate" > (0)::numeric);



CREATE INDEX "idx_orders_order_type" ON "public"."orders" USING "btree" ("order_type");



CREATE INDEX "idx_orders_partner_name" ON "public"."orders" USING "btree" ("partner_name");



CREATE INDEX "idx_orders_payment_status" ON "public"."orders" USING "btree" ("customer_id", "status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'payment_failed'::"text"]));



CREATE INDEX "idx_orders_pet_id" ON "public"."orders" USING "btree" ("pet_id") WHERE ("pet_id" IS NOT NULL);



CREATE INDEX "idx_orders_service_id" ON "public"."orders" USING "btree" ("service_id") WHERE ("service_id" IS NOT NULL);



CREATE INDEX "idx_orders_shipping_cost" ON "public"."orders" USING "btree" ("shipping_cost") WHERE ("shipping_cost" > (0)::numeric);



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_partner_products_currency" ON "public"."partner_products" USING "btree" ("currency");



CREATE INDEX "idx_partner_services_currency" ON "public"."partner_services" USING "btree" ("currency");



CREATE INDEX "idx_partner_services_place_id" ON "public"."partner_services" USING "btree" ("place_id");



CREATE INDEX "idx_partners_country_id" ON "public"."partners" USING "btree" ("country_id");



CREATE INDEX "idx_partners_department_id" ON "public"."partners" USING "btree" ("department_id");



CREATE INDEX "idx_partners_iva" ON "public"."partners" USING "btree" ("iva_rate") WHERE ("iva_rate" > (0)::numeric);



CREATE INDEX "idx_partners_location" ON "public"."partners" USING "btree" ("latitud", "longitud") WHERE (("latitud" IS NOT NULL) AND ("longitud" IS NOT NULL));



CREATE INDEX "idx_partners_rut" ON "public"."partners" USING "btree" ("rut");



CREATE INDEX "idx_partners_user_id" ON "public"."partners" USING "btree" ("user_id");



CREATE INDEX "idx_pet_albums_images" ON "public"."pet_albums" USING "gin" ("images");



CREATE INDEX "idx_pet_behavior_assessment_date" ON "public"."pet_behavior" USING "btree" ("pet_id", "assessment_date" DESC);



CREATE INDEX "idx_pet_behavior_pet_id" ON "public"."pet_behavior" USING "btree" ("pet_id");



CREATE INDEX "idx_pet_shares_owner_id" ON "public"."pet_shares" USING "btree" ("owner_id");



CREATE INDEX "idx_pet_shares_pet_id" ON "public"."pet_shares" USING "btree" ("pet_id");



CREATE INDEX "idx_pet_shares_shared_with" ON "public"."pet_shares" USING "btree" ("shared_with_user_id");



CREATE INDEX "idx_pet_shares_status" ON "public"."pet_shares" USING "btree" ("status");



CREATE INDEX "idx_places_active" ON "public"."places" USING "btree" ("is_active");



CREATE INDEX "idx_places_category" ON "public"."places" USING "btree" ("category");



CREATE INDEX "idx_places_created_at" ON "public"."places" USING "btree" ("created_at");



CREATE INDEX "idx_places_partner_id" ON "public"."places" USING "btree" ("partner_id");



CREATE INDEX "idx_posts_album_id" ON "public"."posts" USING "btree" ("album_id") WHERE ("album_id" IS NOT NULL);



CREATE INDEX "idx_profiles_biometric_enabled" ON "public"."profiles" USING "btree" ("biometric_enabled") WHERE ("biometric_enabled" = true);



CREATE INDEX "idx_profiles_country_id" ON "public"."profiles" USING "btree" ("country_id");



CREATE INDEX "idx_profiles_department_id" ON "public"."profiles" USING "btree" ("department_id");



CREATE INDEX "idx_profiles_email_confirmed" ON "public"."profiles" USING "btree" ("email_confirmed") WHERE ("email_confirmed" = true);



CREATE INDEX "idx_profiles_fcm_token" ON "public"."profiles" USING "btree" ("fcm_token") WHERE ("fcm_token" IS NOT NULL);



CREATE INDEX "idx_profiles_push_token" ON "public"."profiles" USING "btree" ("push_token");



CREATE INDEX "idx_promotion_billing_partner_id" ON "public"."promotion_billing" USING "btree" ("partner_id");



CREATE INDEX "idx_promotion_billing_promotion_id" ON "public"."promotion_billing" USING "btree" ("promotion_id");



CREATE INDEX "idx_promotion_billing_status" ON "public"."promotion_billing" USING "btree" ("status");



CREATE INDEX "idx_promotions_active_dates" ON "public"."promotions" USING "btree" ("is_active", "start_date", "end_date") WHERE ("is_active" = true);



CREATE INDEX "idx_promotions_categories" ON "public"."promotions" USING "gin" ("applicable_categories") WHERE (("applicable_categories" IS NOT NULL) AND ("array_length"("applicable_categories", 1) > 0));



CREATE INDEX "idx_promotions_featured" ON "public"."promotions" USING "btree" ("is_featured", "priority" DESC) WHERE ("is_featured" = true);



CREATE INDEX "idx_promotions_has_discount" ON "public"."promotions" USING "btree" ("has_discount", "is_active") WHERE ("has_discount" = true);



CREATE INDEX "idx_promotions_partner_active" ON "public"."promotions" USING "btree" ("partner_id", "is_active", "start_date", "end_date") WHERE (("partner_id" IS NOT NULL) AND ("is_active" = true));



CREATE INDEX "idx_promotions_priority" ON "public"."promotions" USING "btree" ("priority" DESC, "created_at" DESC);



CREATE INDEX "idx_promotions_products" ON "public"."promotions" USING "gin" ("applicable_products") WHERE (("applicable_products" IS NOT NULL) AND ("array_length"("applicable_products", 1) > 0));



CREATE INDEX "idx_promotions_promo_code" ON "public"."promotions" USING "btree" ("promo_code") WHERE ("promo_code" IS NOT NULL);



CREATE INDEX "idx_scheduled_notifications_pending" ON "public"."scheduled_notifications" USING "btree" ("status", "scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_scheduled_notifications_reference" ON "public"."scheduled_notifications" USING "btree" ("reference_id", "reference_type");



CREATE INDEX "idx_scheduled_notifications_scheduled_for" ON "public"."scheduled_notifications" USING "btree" ("scheduled_for");



CREATE INDEX "idx_scheduled_notifications_status" ON "public"."scheduled_notifications" USING "btree" ("status");



CREATE INDEX "idx_scheduled_notifications_user_id" ON "public"."scheduled_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_service_reviews_booking_id" ON "public"."service_reviews" USING "btree" ("booking_id");



CREATE INDEX "idx_service_reviews_customer_id" ON "public"."service_reviews" USING "btree" ("customer_id");



CREATE INDEX "idx_service_reviews_partner_id" ON "public"."service_reviews" USING "btree" ("partner_id");



CREATE INDEX "idx_service_reviews_service_id" ON "public"."service_reviews" USING "btree" ("service_id");



CREATE INDEX "idx_subscription_plans_active" ON "public"."subscription_plans" USING "btree" ("is_active");



CREATE INDEX "idx_treatments_cache_key" ON "public"."treatments_ai_cache" USING "btree" ("cache_key");



CREATE INDEX "idx_treatments_expires_at" ON "public"."treatments_ai_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_treatments_species_illness" ON "public"."treatments_ai_cache" USING "btree" ("species", "illness_name");



CREATE UNIQUE INDEX "idx_unique_booking_reminder" ON "public"."scheduled_notifications" USING "btree" ("reference_id", "notification_type") WHERE (("notification_type" = 'booking_reminder'::"text") AND ("status" = ANY (ARRAY['pending'::"text", 'sent'::"text"])));



CREATE UNIQUE INDEX "idx_unique_vaccine_reminder" ON "public"."scheduled_notifications" USING "btree" ("reference_id", "notification_type", "status") WHERE ("notification_type" = ANY (ARRAY['vaccine_reminder_7days'::"text", 'vaccine_reminder_24hours'::"text"]));



CREATE INDEX "idx_user_subscriptions_status" ON "public"."user_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_user_subscriptions_user_id" ON "public"."user_subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_vaccination_schedules_species" ON "public"."vaccination_schedules" USING "btree" ("species", "age_weeks_min");



CREATE INDEX "idx_vaccine_cache_expiry" ON "public"."vaccine_recommendations_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_vaccine_cache_lookup" ON "public"."vaccine_recommendations_cache" USING "btree" ("species", "age_range");



CREATE INDEX "idx_veterinary_clinics_active" ON "public"."veterinary_clinics" USING "btree" ("is_active");



CREATE INDEX "idx_webhook_logs_created_at" ON "public"."webhook_logs" USING "btree" ("created_at");



CREATE INDEX "idx_webhook_logs_order_id" ON "public"."webhook_logs" USING "btree" ("order_id");



CREATE INDEX "idx_webhook_logs_webhook_subscription_id" ON "public"."webhook_logs" USING "btree" ("webhook_subscription_id");



CREATE INDEX "idx_webhook_subscriptions_is_active" ON "public"."webhook_subscriptions" USING "btree" ("is_active");



CREATE INDEX "idx_webhook_subscriptions_partner_id" ON "public"."webhook_subscriptions" USING "btree" ("partner_id");



CREATE OR REPLACE TRIGGER "booking_create_order" AFTER INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."create_order_for_booking"();



CREATE OR REPLACE TRIGGER "on_booking_confirmed" AFTER INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."create_booking_reminder_notification"();



CREATE OR REPLACE TRIGGER "on_order_payment_confirmed_send_email" AFTER INSERT OR UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."send_order_confirmation_email"();



COMMENT ON TRIGGER "on_order_payment_confirmed_send_email" ON "public"."orders" IS 'Trigger que envía correo de confirmación automáticamente cuando se confirma el pago de una orden (INSERT o UPDATE)';



CREATE OR REPLACE TRIGGER "on_order_status_change" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."create_order_status_notification"();



CREATE OR REPLACE TRIGGER "on_pet_share_created" AFTER INSERT ON "public"."pet_shares" FOR EACH ROW WHEN (("new"."status" = 'pending'::"text")) EXECUTE FUNCTION "public"."notify_pet_share_created"();



CREATE OR REPLACE TRIGGER "on_pet_share_status_changed" AFTER UPDATE ON "public"."pet_shares" FOR EACH ROW EXECUTE FUNCTION "public"."notify_pet_share_accepted"();



CREATE OR REPLACE TRIGGER "on_vaccine_created_or_updated" AFTER INSERT OR UPDATE ON "public"."pet_health" FOR EACH ROW EXECUTE FUNCTION "public"."create_vaccine_reminder_notifications"();



CREATE OR REPLACE TRIGGER "on_vaccine_deleted" AFTER DELETE ON "public"."pet_health" FOR EACH ROW EXECUTE FUNCTION "public"."create_vaccine_reminder_notifications"();



CREATE OR REPLACE TRIGGER "order_created_webhook" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_crm_and_accounting_webhook"();



CREATE OR REPLACE TRIGGER "order_updated_webhook" AFTER UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_crm_and_accounting_webhook"();



CREATE OR REPLACE TRIGGER "set_pet_shares_updated_at" BEFORE UPDATE ON "public"."pet_shares" FOR EACH ROW EXECUTE FUNCTION "public"."update_pet_shares_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_check_stock_after_update" BEFORE UPDATE OF "stock" ON "public"."partner_products" FOR EACH ROW EXECUTE FUNCTION "public"."check_and_disable_product"();



COMMENT ON TRIGGER "trigger_check_stock_after_update" ON "public"."partner_products" IS 'Desactiva/Activa productos automáticamente según disponibilidad de stock';



CREATE OR REPLACE TRIGGER "trigger_decrease_stock_on_insert" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."decrease_stock_on_order_insert"();



COMMENT ON TRIGGER "trigger_decrease_stock_on_insert" ON "public"."orders" IS 'Descuenta stock al momento de crear la orden (INSERT)';



CREATE OR REPLACE TRIGGER "trigger_generate_alerts_new_pet" AFTER INSERT ON "public"."pets" FOR EACH ROW EXECUTE FUNCTION "public"."generate_alerts_for_new_pet"();



CREATE OR REPLACE TRIGGER "trigger_medical_alerts_on_health_insert" AFTER INSERT ON "public"."pet_health" FOR EACH ROW EXECUTE FUNCTION "public"."generate_medical_alerts"();



CREATE OR REPLACE TRIGGER "trigger_pet_albums_updated_at" BEFORE UPDATE ON "public"."pet_albums" FOR EACH ROW EXECUTE FUNCTION "public"."update_pet_albums_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_restore_stock_on_cancel" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW WHEN ((("new"."status" = 'cancelled'::"text") AND ("old"."status" <> 'cancelled'::"text"))) EXECUTE FUNCTION "public"."restore_stock_on_order_cancel"();



COMMENT ON TRIGGER "trigger_restore_stock_on_cancel" ON "public"."orders" IS 'Restaura stock cuando una orden cambia a status=cancelled';



CREATE OR REPLACE TRIGGER "trigger_set_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_number"();



CREATE OR REPLACE TRIGGER "trigger_sync_booking_on_order_update" AFTER UPDATE ON "public"."orders" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") OR ("old"."payment_status" IS DISTINCT FROM "new"."payment_status"))) EXECUTE FUNCTION "public"."sync_booking_status_on_order_update"();



CREATE OR REPLACE TRIGGER "trigger_update_adoption_chat_updated_at" AFTER INSERT ON "public"."adoption_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_adoption_chat_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_alerts_on_health_insert" AFTER INSERT ON "public"."pet_health" FOR EACH ROW EXECUTE FUNCTION "public"."update_alert_status"();



CREATE OR REPLACE TRIGGER "trigger_update_chatbot_conversation_last_message" AFTER INSERT ON "public"."chatbot_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_chatbot_conversation_last_message"();



CREATE OR REPLACE TRIGGER "trigger_update_has_discount" BEFORE INSERT OR UPDATE ON "public"."promotions" FOR EACH ROW EXECUTE FUNCTION "public"."update_has_discount"();



CREATE OR REPLACE TRIGGER "trigger_update_partner_rating_on_delete" AFTER DELETE ON "public"."service_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_partner_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_partner_rating_on_insert" AFTER INSERT ON "public"."service_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_partner_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_partner_rating_on_update" AFTER UPDATE ON "public"."service_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_partner_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_places_updated_at" BEFORE UPDATE ON "public"."places" FOR EACH ROW EXECUTE FUNCTION "public"."update_places_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_promotions_updated_at" BEFORE UPDATE ON "public"."promotions" FOR EACH ROW EXECUTE FUNCTION "public"."update_promotions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_session_message_count" AFTER INSERT ON "public"."ai_chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_session_message_count"();



CREATE OR REPLACE TRIGGER "update_app_config_updated_at" BEFORE UPDATE ON "public"."app_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_app_config_updated_at"();



CREATE OR REPLACE TRIGGER "update_booking_tokens_updated_at_trigger" BEFORE UPDATE ON "public"."booking_confirmation_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_booking_tokens_updated_at"();



CREATE OR REPLACE TRIGGER "update_conversation_last_message_trigger" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_last_message"();



CREATE OR REPLACE TRIGGER "update_partner_products_updated_at" BEFORE UPDATE ON "public"."partner_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



COMMENT ON TRIGGER "update_partner_products_updated_at" ON "public"."partner_products" IS 'Actualiza automáticamente updated_at en cada modificación del producto';



CREATE OR REPLACE TRIGGER "update_pet_behavior_updated_at_trigger" BEFORE UPDATE ON "public"."pet_behavior" FOR EACH ROW EXECUTE FUNCTION "public"."update_pet_behavior_updated_at"();



CREATE OR REPLACE TRIGGER "update_scheduled_notifications_updated_at_trigger" BEFORE UPDATE ON "public"."scheduled_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_scheduled_notifications_updated_at"();



CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_settings_updated_at" BEFORE UPDATE ON "public"."subscription_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_subscriptions_updated_at" BEFORE UPDATE ON "public"."user_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "webhook_subscription_updated_at" BEFORE UPDATE ON "public"."webhook_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_webhook_subscription_updated_at"();



ALTER TABLE ONLY "public"."accounting_webhook_logs"
    ADD CONSTRAINT "accounting_webhook_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adoption_chats"
    ADD CONSTRAINT "adoption_chats_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adoption_chats"
    ADD CONSTRAINT "adoption_chats_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adoption_messages"
    ADD CONSTRAINT "adoption_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."adoption_chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adoption_messages"
    ADD CONSTRAINT "adoption_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."adoption_pets"
    ADD CONSTRAINT "adoption_pets_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_chat_messages"
    ADD CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."ai_chat_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_chat_messages"
    ADD CONSTRAINT "ai_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_chat_sessions"
    ADD CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_confirmation_tokens"
    ADD CONSTRAINT "booking_confirmation_tokens_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."partner_services"("id");



ALTER TABLE ONLY "public"."business_schedule"
    ADD CONSTRAINT "business_schedule_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_adoption_pet_id_fkey" FOREIGN KEY ("adoption_pet_id") REFERENCES "public"."adoption_pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chatbot_messages"
    ADD CONSTRAINT "chatbot_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chatbot_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."crm_webhook_logs"
    ADD CONSTRAINT "crm_webhook_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_confirmations"
    ADD CONSTRAINT "email_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "fk_places_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."medical_alerts"
    ADD CONSTRAINT "medical_alerts_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_alerts"
    ADD CONSTRAINT "medical_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_history_tokens"
    ADD CONSTRAINT "medical_history_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_history_tokens"
    ADD CONSTRAINT "medical_history_tokens_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."medical_treatments"
    ADD CONSTRAINT "medical_treatments_condition_id_fkey" FOREIGN KEY ("condition_id") REFERENCES "public"."medical_conditions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_products"
    ADD CONSTRAINT "partner_products_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_services"
    ADD CONSTRAINT "partner_services_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_services"
    ADD CONSTRAINT "partner_services_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pet_albums"
    ADD CONSTRAINT "pet_albums_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");



ALTER TABLE ONLY "public"."pet_albums"
    ADD CONSTRAINT "pet_albums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pet_behavior"
    ADD CONSTRAINT "pet_behavior_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");



ALTER TABLE ONLY "public"."pet_behavior"
    ADD CONSTRAINT "pet_behavior_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pet_health"
    ADD CONSTRAINT "pet_health_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");



ALTER TABLE ONLY "public"."pet_health"
    ADD CONSTRAINT "pet_health_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pet_shares"
    ADD CONSTRAINT "pet_shares_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_shares"
    ADD CONSTRAINT "pet_shares_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_shares"
    ADD CONSTRAINT "pet_shares_shared_with_user_id_fkey" FOREIGN KEY ("shared_with_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."places"
    ADD CONSTRAINT "places_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "public"."pet_albums"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."promotion_billing"
    ADD CONSTRAINT "promotion_billing_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."promotion_billing"
    ADD CONSTRAINT "promotion_billing_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promotion_billing"
    ADD CONSTRAINT "promotion_billing_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id");



ALTER TABLE ONLY "public"."scheduled_notifications"
    ADD CONSTRAINT "scheduled_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_reviews"
    ADD CONSTRAINT "service_reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."partner_services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_settings"
    ADD CONSTRAINT "subscription_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_carts"
    ADD CONSTRAINT "user_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_subscriptions"
    ADD CONSTRAINT "webhook_subscriptions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can create subscriptions" ON "public"."user_subscriptions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can delete subscription plans" ON "public"."subscription_plans" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can insert broadcast notifications" ON "public"."scheduled_notifications" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))) AND ("notification_type" = 'broadcast'::"text")));



CREATE POLICY "Admin can insert subscription plans" ON "public"."subscription_plans" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can insert subscription settings" ON "public"."subscription_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can manage all promotion billing" ON "public"."promotion_billing" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can manage all promotions" ON "public"."promotions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can manage all settings" ON "public"."admin_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."email")::"text" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "auth"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."email")::"text" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can update partner verification status" ON "public"."partners" FOR UPDATE TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'admin@dogcatify.com'::"text")) WITH CHECK ((("auth"."jwt"() ->> 'email'::"text") = 'admin@dogcatify.com'::"text"));



CREATE POLICY "Admin can update subscription plans" ON "public"."subscription_plans" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can update subscription settings" ON "public"."subscription_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can update subscriptions" ON "public"."user_subscriptions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can view all partner profiles" ON "public"."partners" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'admin@dogcatify.com'::"text"));



CREATE POLICY "Admin can view all subscription plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admin can view all subscriptions" ON "public"."user_subscriptions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admins can manage all promotions" ON "public"."promotions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Admins can update all partners" ON "public"."partners" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all partners" ON "public"."partners" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all pets" ON "public"."pets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all places" ON "public"."places" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all products" ON "public"."partner_products" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all promotions" ON "public"."promotions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view crm webhook logs" ON "public"."crm_webhook_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Allow customers, partners, and service role to insert orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "orders"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Anonymous users can insert login failure logs" ON "public"."audit_logs" FOR INSERT TO "anon" WITH CHECK (("action" = ANY (ARRAY['LOGIN_FAILED'::"text", 'LOGIN_ERROR'::"text", 'LOGIN_ATTEMPT'::"text"])));



CREATE POLICY "Anyone can create chatbot conversations" ON "public"."chatbot_conversations" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can insert chatbot messages" ON "public"."chatbot_messages" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can read chatbot conversations" ON "public"."chatbot_conversations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read chatbot messages" ON "public"."chatbot_messages" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read public configs" ON "public"."app_config" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Anyone can read reviews for public display" ON "public"."service_reviews" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can update post likes" ON "public"."posts" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can view active places" ON "public"."places" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active products" ON "public"."partner_products" FOR SELECT TO "authenticated" USING ((("is_active" = true) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "partner_products"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Anyone can view active promotions" ON "public"."promotions" FOR SELECT TO "authenticated" USING (((("is_active" = true) AND ("start_date" <= "now"()) AND ("end_date" >= "now"())) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))) OR (("partner_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "promotions"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Anyone can view active subscription plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Anyone can view business schedules" ON "public"."business_schedule" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view comments" ON "public"."comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view deworming schedules" ON "public"."deworming_schedules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view pet behavior assessments" ON "public"."pet_behavior" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view posts" ON "public"."posts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view vaccination schedules" ON "public"."vaccination_schedules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete configs" ON "public"."app_config" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete partners" ON "public"."partners" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert audit logs" ON "public"."audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert configs" ON "public"."app_config" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert partners" ON "public"."partners" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read all configs" ON "public"."app_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read partners" ON "public"."partners" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update chatbot conversations" ON "public"."chatbot_conversations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update chatbot messages" ON "public"."chatbot_messages" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update configs" ON "public"."app_config" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update partners" ON "public"."partners" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view all places" ON "public"."places" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view audit logs (TEMP DEBUG)" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Chat participants can send messages" ON "public"."adoption_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."adoption_chats"
  WHERE (("adoption_chats"."id" = "adoption_messages"."chat_id") AND (("adoption_chats"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."partners"
          WHERE (("partners"."id" = "adoption_chats"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))))))));



CREATE POLICY "Chat participants can view messages" ON "public"."adoption_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."adoption_chats"
  WHERE (("adoption_chats"."id" = "adoption_messages"."chat_id") AND (("adoption_chats"."customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."partners"
          WHERE (("partners"."id" = "adoption_chats"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Countries are publicly readable" ON "public"."countries" FOR SELECT USING (true);



CREATE POLICY "Customers can create adoption chats" ON "public"."adoption_chats" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "Customers can create their own reviews" ON "public"."service_reviews" FOR INSERT TO "authenticated" WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "Customers can delete their own bookings" ON "public"."bookings" FOR DELETE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "bookings"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Customers can read their own reviews" ON "public"."service_reviews" FOR SELECT TO "authenticated" USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "Customers can update their own bookings" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "bookings"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Customers can view their own adoption chats" ON "public"."adoption_chats" FOR SELECT TO "authenticated" USING (("customer_id" = "auth"."uid"()));



CREATE POLICY "Customers can view their own bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "bookings"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Customers, partners and admins can insert bookings" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "bookings"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Departments are publicly readable" ON "public"."departments" FOR SELECT USING (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."admin_settings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."admin_settings" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."orders" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."partner_services" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."partners" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pet_albums" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."pets" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."user_carts" FOR SELECT USING (true);



CREATE POLICY "Only admins can manage deworming schedules" ON "public"."deworming_schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Only admins can manage places" ON "public"."places" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Only admins can manage vaccination schedules" ON "public"."vaccination_schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Owners can create pet shares" ON "public"."pet_shares" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "owner_id") AND (EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "pet_shares"."pet_id") AND ("pets"."owner_id" = "auth"."uid"()))))));



CREATE POLICY "Owners can delete pet shares" ON "public"."pet_shares" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can update their pet shares" ON "public"."pet_shares" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can view their pet shares" ON "public"."pet_shares" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Participantes pueden actualizar conversaciones" ON "public"."chat_conversations" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "chat_conversations"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Participantes pueden enviar mensajes" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."chat_conversations"
  WHERE (("chat_conversations"."id" = "chat_messages"."conversation_id") AND (("chat_conversations"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."partners"
          WHERE (("partners"."id" = "chat_conversations"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))))))));



CREATE POLICY "Participantes pueden marcar mensajes como leídos" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_conversations"
  WHERE (("chat_conversations"."id" = "chat_messages"."conversation_id") AND (("chat_conversations"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."partners"
          WHERE (("partners"."id" = "chat_conversations"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Participantes pueden ver mensajes de sus conversaciones" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."chat_conversations"
  WHERE (("chat_conversations"."id" = "chat_messages"."conversation_id") AND (("chat_conversations"."user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."partners"
          WHERE (("partners"."id" = "chat_conversations"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Participants can update adoption chats" ON "public"."adoption_chats" FOR UPDATE TO "authenticated" USING ((("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "adoption_chats"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Partners and admins can update orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "orders"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))) OR ("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "orders"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))) OR ("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Partners can create own places" ON "public"."places" FOR INSERT TO "authenticated" WITH CHECK (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can create own webhook subscriptions" ON "public"."webhook_subscriptions" FOR INSERT TO "authenticated" WITH CHECK (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can delete own businesses" ON "public"."partners" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Partners can delete own places" ON "public"."places" FOR DELETE TO "authenticated" USING (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can delete own webhook subscriptions" ON "public"."webhook_subscriptions" FOR DELETE TO "authenticated" USING (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can delete their own products" ON "public"."partner_products" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "partner_products"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can delete their own schedules" ON "public"."business_schedule" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "business_schedule"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can delete their own services" ON "public"."partner_services" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "partner_services"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can insert their own products" ON "public"."partner_products" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "partner_products"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can insert their own schedules" ON "public"."business_schedule" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "business_schedule"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can insert their own services" ON "public"."partner_services" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "partner_services"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can read reviews for their services" ON "public"."service_reviews" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "service_reviews"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can update own places" ON "public"."places" FOR UPDATE TO "authenticated" USING (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"())))) WITH CHECK (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can update own webhook subscriptions" ON "public"."webhook_subscriptions" FOR UPDATE TO "authenticated" USING (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"())))) WITH CHECK (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can update their own products" ON "public"."partner_products" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "partner_products"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can update their own schedules" ON "public"."business_schedule" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "business_schedule"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can update their own services" ON "public"."partner_services" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "partner_services"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can view booking tokens for their services" ON "public"."booking_confirmation_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "booking_confirmation_tokens"."order_id") AND ("orders"."partner_id" = "auth"."uid"())))));



CREATE POLICY "Partners can view own places" ON "public"."places" FOR SELECT TO "authenticated" USING (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can view own webhook subscriptions" ON "public"."webhook_subscriptions" FOR SELECT TO "authenticated" USING (("partner_id" IN ( SELECT "partners"."id"
   FROM "public"."partners"
  WHERE ("partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners can view their adoption chats" ON "public"."adoption_chats" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "adoption_chats"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can view their own billing" ON "public"."promotion_billing" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "promotion_billing"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))));



CREATE POLICY "Partners can view their own promotions" ON "public"."promotions" FOR SELECT TO "authenticated" USING ((("partner_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "promotions"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Partners, customers and admins can delete orders" ON "public"."orders" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "orders"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))) OR ("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Partners, customers and admins can update bookings" ON "public"."bookings" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "bookings"."partner_id") AND ("partners"."user_id" = "auth"."uid"())))) OR ("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Pet owners and admins can delete pets" ON "public"."pets" FOR DELETE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Pet owners and admins can update pets" ON "public"."pets" FOR UPDATE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Pet owners can create tokens for their pets" ON "public"."medical_history_tokens" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "medical_history_tokens"."pet_id") AND ("pets"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Pet owners can view their tokens" ON "public"."medical_history_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "medical_history_tokens"."pet_id") AND ("pets"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Public can access valid tokens" ON "public"."medical_history_tokens" FOR SELECT TO "anon" USING (("expires_at" > "now"()));



CREATE POLICY "Public can confirm tokens" ON "public"."email_confirmations" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Public can verify tokens" ON "public"."email_confirmations" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Service role can insert orders" ON "public"."orders" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage all email confirmations" ON "public"."email_confirmations" TO "service_role" USING (true);



CREATE POLICY "Service role can manage booking tokens" ON "public"."booking_confirmation_tokens" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage email confirmations" ON "public"."email_confirmations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can update access tracking" ON "public"."medical_history_tokens" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Shared users can update share status" ON "public"."pet_shares" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "shared_with_user_id") AND ("status" = 'pending'::"text"))) WITH CHECK ((("auth"."uid"() = "shared_with_user_id") AND ("status" = ANY (ARRAY['accepted'::"text", 'rejected'::"text"]))));



CREATE POLICY "Shared users can view their shares" ON "public"."pet_shares" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "shared_with_user_id"));



CREATE POLICY "Solo administradores pueden gestionar alergias" ON "public"."allergies_catalog" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Solo administradores pueden gestionar clínicas" ON "public"."veterinary_clinics" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Solo administradores pueden gestionar condiciones médicas" ON "public"."medical_conditions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Solo administradores pueden gestionar desparasitantes" ON "public"."dewormers_catalog" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Solo administradores pueden gestionar tratamientos" ON "public"."medical_treatments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Solo administradores pueden gestionar vacunas" ON "public"."vaccines_catalog" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."email" = 'admin@dogcatify.com'::"text")))));



CREATE POLICY "Solo admins pueden ver logs de contabilidad" ON "public"."accounting_webhook_logs" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'admin@dogcatify.com'::"text"));



CREATE POLICY "Solo edge functions pueden actualizar cache" ON "public"."vaccine_recommendations_cache" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Solo edge functions pueden insertar en cache" ON "public"."vaccine_recommendations_cache" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Solo el sistema puede insertar en caché de desparasitantes" ON "public"."dewormers_ai_cache" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Solo refugios pueden gestionar sus mascotas" ON "public"."adoption_pets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "adoption_pets"."partner_id") AND ("partners"."user_id" = "auth"."uid"()) AND ("partners"."business_type" = 'shelter'::"text")))));



CREATE POLICY "System can insert crm webhook logs" ON "public"."crm_webhook_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert webhook logs" ON "public"."webhook_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Todos pueden ver alergias activas" ON "public"."allergies_catalog" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Todos pueden ver clínicas activas" ON "public"."veterinary_clinics" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Todos pueden ver condiciones médicas activas" ON "public"."medical_conditions" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Todos pueden ver desparasitantes activos" ON "public"."dewormers_catalog" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Todos pueden ver mascotas en adopción activas" ON "public"."adoption_pets" FOR SELECT TO "authenticated" USING (("is_available" = true));



CREATE POLICY "Todos pueden ver tratamientos activos" ON "public"."medical_treatments" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Todos pueden ver vacunas activas" ON "public"."vaccines_catalog" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Users can delete health records for their pets" ON "public"."pet_health" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own behavior assessments" ON "public"."pet_behavior" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own cart" ON "public"."user_carts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own partner profiles" ON "public"."partners" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own pet albums" ON "public"."pet_albums" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own pet alerts" ON "public"."medical_alerts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own pet behavior assessments" ON "public"."pet_behavior" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own pets" ON "public"."pets" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can delete their own posts" ON "public"."posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profile" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert alerts for their pets" ON "public"."medical_alerts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert behavior assessments for their own pets" ON "public"."pet_behavior" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "pet_behavior"."pet_id") AND ("pets"."owner_id" = "auth"."uid"())))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can insert health records for their pets" ON "public"."pet_health" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own chat messages" ON "public"."ai_chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own chat sessions" ON "public"."ai_chat_sessions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own cart" ON "public"."user_carts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own comments" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own partner profiles" ON "public"."partners" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own pet albums" ON "public"."pet_albums" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own pet behavior assessments" ON "public"."pet_behavior" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own pets" ON "public"."pets" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can insert their own posts" ON "public"."posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own email confirmations" ON "public"."email_confirmations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update comment likes" ON "public"."comments" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update health records for their pets" ON "public"."pet_health" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own biometric settings" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own chat sessions" ON "public"."ai_chat_sessions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update promotion engagement" ON "public"."promotions" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can update their own behavior assessments" ON "public"."pet_behavior" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own cart" ON "public"."user_carts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own partner profiles" ON "public"."partners" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pet albums" ON "public"."pet_albums" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pet alerts" ON "public"."medical_alerts" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own pet behavior assessments" ON "public"."pet_behavior" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pets" ON "public"."pets" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can update their own posts content" ON "public"."posts" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view active subscription plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Users can view any pet health record" ON "public"."pet_health" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view behavior assessments of their own pets" ON "public"."pet_behavior" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."pets"
  WHERE (("pets"."id" = "pet_behavior"."pet_id") AND ("pets"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own booking confirmation tokens" ON "public"."booking_confirmation_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "booking_confirmation_tokens"."order_id") AND ("orders"."customer_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own chat messages" ON "public"."ai_chat_messages" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own chat sessions" ON "public"."ai_chat_sessions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."scheduled_notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own subscription" ON "public"."user_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own subscriptions" ON "public"."user_subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view subscription settings" ON "public"."subscription_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view their own partner profiles" ON "public"."partners" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own pet alerts" ON "public"."medical_alerts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Usuarios autenticados pueden insertar en caché de alergias" ON "public"."allergies_ai_cache" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Usuarios autenticados pueden insertar en caché de enfermedades" ON "public"."illnesses_ai_cache" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Usuarios autenticados pueden insertar en caché de tratamientos" ON "public"."treatments_ai_cache" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Usuarios autenticados pueden leer cache de vacunas" ON "public"."vaccine_recommendations_cache" FOR SELECT TO "authenticated" USING (("expires_at" > "now"()));



CREATE POLICY "Usuarios autenticados pueden leer caché de alergias" ON "public"."allergies_ai_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuarios autenticados pueden leer caché de desparasitantes" ON "public"."dewormers_ai_cache" FOR SELECT TO "authenticated" USING (("expires_at" > "now"()));



CREATE POLICY "Usuarios autenticados pueden leer caché de enfermedades" ON "public"."illnesses_ai_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuarios autenticados pueden leer caché de tratamientos" ON "public"."treatments_ai_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Usuarios pueden crear conversaciones" ON "public"."chat_conversations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Usuarios pueden ver sus conversaciones" ON "public"."chat_conversations" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."partners"
  WHERE (("partners"."id" = "chat_conversations"."partner_id") AND ("partners"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."accounting_webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adoption_chats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adoption_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."adoption_pets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_chat_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allergies_ai_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."allergies_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_confirmation_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chatbot_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chatbot_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dewormers_ai_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dewormers_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deworming_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_confirmations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."illnesses_ai_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_history_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medical_treatments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_albums" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_behavior" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_health" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pet_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."places" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotion_billing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatments_ai_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_carts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccination_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccine_recommendations_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vaccines_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."veterinary_clinics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_subscriptions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_pet_age_weeks"("pet_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_pet_age_weeks"("pet_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_pet_age_weeks"("pet_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_alert_thresholds_cron"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_alert_thresholds_cron"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_alert_thresholds_cron"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_and_disable_product"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_and_disable_product"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_and_disable_product"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_boarding_capacity"("p_service_id" "uuid", "p_category" "text", "p_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."check_boarding_capacity"("p_service_id" "uuid", "p_category" "text", "p_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_boarding_capacity"("p_service_id" "uuid", "p_category" "text", "p_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_allergy_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_allergy_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_allergy_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_dewormer_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_dewormer_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_dewormer_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_email_confirmations"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_email_confirmations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_email_confirmations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_email_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_email_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_email_tokens"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_illness_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_illness_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_illness_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_medical_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_medical_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_medical_tokens"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_vaccine_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_vaccine_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_vaccine_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_reminder_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_reminder_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_reminder_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_order_for_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_order_for_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_order_for_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_order_status_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_order_status_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_order_status_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_vaccine_reminder_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_vaccine_reminder_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_vaccine_reminder_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrease_stock_on_order_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrease_stock_on_order_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrease_stock_on_order_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_completely"("user_id_to_delete" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_completely"("user_id_to_delete" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_completely"("user_id_to_delete" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."format_time_12h"("time_24h" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."format_time_12h"("time_24h" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_time_12h"("time_24h" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_alerts_for_new_pet"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_alerts_for_new_pet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_alerts_for_new_pet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_medical_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_medical_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_medical_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "postgres";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "anon";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_webhook_edge_function"("order_id_param" "uuid", "event_type_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_webhook_edge_function"("order_id_param" "uuid", "event_type_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_webhook_edge_function"("order_id_param" "uuid", "event_type_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_payment_link_expired"("order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_payment_link_expired"("order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_payment_link_expired"("order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_email_confirmed"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_email_confirmed"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_email_confirmed"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_payment_as_failed"("order_id" "uuid", "reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_payment_as_failed"("order_id" "uuid", "reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_payment_as_failed"("order_id" "uuid", "reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_order_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_order_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_order_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_pet_share_accepted"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_pet_share_accepted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_pet_share_accepted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_pet_share_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_pet_share_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_pet_share_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_stock_on_order_cancel"() TO "anon";
GRANT ALL ON FUNCTION "public"."restore_stock_on_order_cancel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_stock_on_order_cancel"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_medical_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_medical_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_medical_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."send_order_confirmation_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."send_order_confirmation_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_order_confirmation_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_booking_status_on_order_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_booking_status_on_order_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_booking_status_on_order_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_crm_and_accounting_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_crm_and_accounting_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_crm_and_accounting_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_crm_webhook"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_crm_webhook"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_crm_webhook"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_generate_alerts_new_pet"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_generate_alerts_new_pet"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_generate_alerts_new_pet"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_generate_medical_alerts"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_generate_medical_alerts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_generate_medical_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_webhook_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_webhook_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_webhook_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_adoption_chat_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_adoption_chat_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_adoption_chat_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_alert_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_alert_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_alert_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_app_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_app_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_app_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_booking_tokens_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_booking_tokens_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_booking_tokens_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_chatbot_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_chatbot_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_chatbot_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_has_discount"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_has_discount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_has_discount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_partner_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_partner_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_partner_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pet_albums_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pet_albums_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pet_albums_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pet_behavior_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pet_behavior_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pet_behavior_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pet_shares_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pet_shares_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pet_shares_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_places_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_places_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_places_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_promotions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_promotions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_promotions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scheduled_notifications_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scheduled_notifications_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scheduled_notifications_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_message_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_message_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_message_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_webhook_subscription_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_webhook_subscription_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_webhook_subscription_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "service_role";
























GRANT ALL ON TABLE "public"."accounting_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."accounting_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."accounting_webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_settings" TO "anon";
GRANT ALL ON TABLE "public"."admin_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_settings" TO "service_role";



GRANT ALL ON TABLE "public"."adoption_chats" TO "anon";
GRANT ALL ON TABLE "public"."adoption_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."adoption_chats" TO "service_role";



GRANT ALL ON TABLE "public"."adoption_messages" TO "anon";
GRANT ALL ON TABLE "public"."adoption_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."adoption_messages" TO "service_role";



GRANT ALL ON TABLE "public"."adoption_pets" TO "anon";
GRANT ALL ON TABLE "public"."adoption_pets" TO "authenticated";
GRANT ALL ON TABLE "public"."adoption_pets" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."ai_chat_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."allergies_ai_cache" TO "anon";
GRANT ALL ON TABLE "public"."allergies_ai_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."allergies_ai_cache" TO "service_role";



GRANT ALL ON TABLE "public"."allergies_catalog" TO "anon";
GRANT ALL ON TABLE "public"."allergies_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."allergies_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."booking_confirmation_tokens" TO "anon";
GRANT ALL ON TABLE "public"."booking_confirmation_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_confirmation_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."business_schedule" TO "anon";
GRANT ALL ON TABLE "public"."business_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."business_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."chat_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chat_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chatbot_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chatbot_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chatbot_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."chatbot_messages" TO "anon";
GRANT ALL ON TABLE "public"."chatbot_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chatbot_messages" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."crm_webhook_debug_logs" TO "anon";
GRANT ALL ON TABLE "public"."crm_webhook_debug_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_webhook_debug_logs" TO "service_role";



GRANT ALL ON TABLE "public"."crm_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."crm_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."dewormers_ai_cache" TO "anon";
GRANT ALL ON TABLE "public"."dewormers_ai_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."dewormers_ai_cache" TO "service_role";



GRANT ALL ON TABLE "public"."dewormers_catalog" TO "anon";
GRANT ALL ON TABLE "public"."dewormers_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."dewormers_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."deworming_schedules" TO "anon";
GRANT ALL ON TABLE "public"."deworming_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."deworming_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."email_confirmations" TO "anon";
GRANT ALL ON TABLE "public"."email_confirmations" TO "authenticated";
GRANT ALL ON TABLE "public"."email_confirmations" TO "service_role";



GRANT ALL ON TABLE "public"."illnesses_ai_cache" TO "anon";
GRANT ALL ON TABLE "public"."illnesses_ai_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."illnesses_ai_cache" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_sequence" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_sequence" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_sequence" TO "service_role";



GRANT ALL ON TABLE "public"."medical_alerts" TO "anon";
GRANT ALL ON TABLE "public"."medical_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."medical_conditions" TO "anon";
GRANT ALL ON TABLE "public"."medical_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."medical_history_tokens" TO "anon";
GRANT ALL ON TABLE "public"."medical_history_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_history_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."medical_treatments" TO "anon";
GRANT ALL ON TABLE "public"."medical_treatments" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_treatments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."order_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."partner_products" TO "anon";
GRANT ALL ON TABLE "public"."partner_products" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_products" TO "service_role";



GRANT ALL ON TABLE "public"."partner_services" TO "anon";
GRANT ALL ON TABLE "public"."partner_services" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_services" TO "service_role";



GRANT ALL ON TABLE "public"."partners" TO "anon";
GRANT ALL ON TABLE "public"."partners" TO "authenticated";
GRANT ALL ON TABLE "public"."partners" TO "service_role";



GRANT ALL ON TABLE "public"."pet_albums" TO "anon";
GRANT ALL ON TABLE "public"."pet_albums" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_albums" TO "service_role";



GRANT ALL ON TABLE "public"."pet_behavior" TO "anon";
GRANT ALL ON TABLE "public"."pet_behavior" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_behavior" TO "service_role";



GRANT ALL ON TABLE "public"."pet_health" TO "anon";
GRANT ALL ON TABLE "public"."pet_health" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_health" TO "service_role";



GRANT ALL ON TABLE "public"."pet_shares" TO "anon";
GRANT ALL ON TABLE "public"."pet_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_shares" TO "service_role";



GRANT ALL ON TABLE "public"."pets" TO "anon";
GRANT ALL ON TABLE "public"."pets" TO "authenticated";
GRANT ALL ON TABLE "public"."pets" TO "service_role";



GRANT ALL ON TABLE "public"."places" TO "anon";
GRANT ALL ON TABLE "public"."places" TO "authenticated";
GRANT ALL ON TABLE "public"."places" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promotion_billing" TO "anon";
GRANT ALL ON TABLE "public"."promotion_billing" TO "authenticated";
GRANT ALL ON TABLE "public"."promotion_billing" TO "service_role";



GRANT ALL ON TABLE "public"."promotions" TO "anon";
GRANT ALL ON TABLE "public"."promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."promotions" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_notifications" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."service_reviews" TO "anon";
GRANT ALL ON TABLE "public"."service_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."service_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_settings" TO "anon";
GRANT ALL ON TABLE "public"."subscription_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_settings" TO "service_role";



GRANT ALL ON TABLE "public"."treatments_ai_cache" TO "anon";
GRANT ALL ON TABLE "public"."treatments_ai_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."treatments_ai_cache" TO "service_role";



GRANT ALL ON TABLE "public"."user_carts" TO "anon";
GRANT ALL ON TABLE "public"."user_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_carts" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."vaccination_schedules" TO "anon";
GRANT ALL ON TABLE "public"."vaccination_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccination_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."vaccine_recommendations_cache" TO "anon";
GRANT ALL ON TABLE "public"."vaccine_recommendations_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccine_recommendations_cache" TO "service_role";



GRANT ALL ON TABLE "public"."vaccines_catalog" TO "anon";
GRANT ALL ON TABLE "public"."vaccines_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccines_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."veterinary_clinics" TO "anon";
GRANT ALL ON TABLE "public"."veterinary_clinics" TO "authenticated";
GRANT ALL ON TABLE "public"."veterinary_clinics" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."webhook_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_subscriptions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
