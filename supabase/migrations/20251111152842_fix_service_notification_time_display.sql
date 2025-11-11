/*
  # Corregir Hora en Notificaciones de Servicios

  1. Problema
    - Las notificaciones de reservas muestran siempre "12:00 AM" porque:
      - appointment_date solo contiene la fecha (con hora 00:00:00)
      - La hora real está en appointment_time como string (ej: "14:00", "09:00")
    
  2. Solución
    - Usar appointment_time directamente (formato 24h) y convertirlo a formato 12h con AM/PM
    - Función para convertir de formato 24h a 12h con AM/PM en español
    
  3. Cambios
    - Actualizar create_order_status_notification() para usar appointment_time correctamente
    - Convertir la hora de 24h a 12h con AM/PM
*/

-- Función auxiliar para convertir hora 24h a 12h con AM/PM
CREATE OR REPLACE FUNCTION format_time_12h(time_24h text)
RETURNS text AS $$
DECLARE
  hour_int int;
  minute_str text;
  period text;
  formatted_hour int;
BEGIN
  -- Si no hay tiempo, retornar NULL
  IF time_24h IS NULL OR time_24h = '' THEN
    RETURN NULL;
  END IF;
  
  -- Extraer hora y minutos del formato "HH:MM"
  hour_int := CAST(split_part(time_24h, ':', 1) AS int);
  minute_str := split_part(time_24h, ':', 2);
  
  -- Determinar AM/PM
  IF hour_int >= 12 THEN
    period := 'PM';
  ELSE
    period := 'AM';
  END IF;
  
  -- Convertir a formato 12 horas
  IF hour_int = 0 THEN
    formatted_hour := 12;
  ELSIF hour_int > 12 THEN
    formatted_hour := hour_int - 12;
  ELSE
    formatted_hour := hour_int;
  END IF;
  
  -- Retornar formato "H:MM AM/PM"
  RETURN format('%s:%s %s', formatted_hour, minute_str, period);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Actualizar función de notificaciones
CREATE OR REPLACE FUNCTION create_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_body text;
  service_date_text text;
  service_time_text text;
  full_datetime_text text;
BEGIN
  -- Solo notificar si el estado cambió
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- Si es un servicio (reserva)
    IF NEW.order_type = 'service_booking' THEN

      -- Obtener fecha del servicio
      service_date_text := COALESCE(
        to_char(NEW.appointment_date, 'DD/MM/YYYY'),
        'la fecha programada'
      );

      -- Obtener hora del servicio desde appointment_time (formato 24h)
      -- y convertirla a formato 12h con AM/PM
      service_time_text := format_time_12h(NEW.appointment_time);

      -- Construir texto completo con fecha y hora
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
          -- Para servicios, no notificar estados como preparing, ready, shipped, delivered
          RETURN NEW;
      END CASE;

    -- Si es un producto (pedido)
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
          -- No notificar para otros estados
          RETURN NEW;
      END CASE;

    ELSE
      -- Tipo de orden desconocido, no notificar
      RETURN NEW;
    END IF;

    -- Insertar notificación para envío inmediato
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
