/*
  # Corregir Columna de Fecha en Notificaciones de Servicios

  1. Problema
    - La función intentaba usar service_date pero la columna correcta es appointment_date

  2. Solución
    - Actualizar la función para usar appointment_date
*/

CREATE OR REPLACE FUNCTION create_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_body text;
  service_date_text text;
BEGIN
  -- Solo notificar si el estado cambió
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- Si es un servicio (reserva)
    IF NEW.order_type = 'service_booking' THEN

      -- Obtener fecha del servicio si existe
      service_date_text := COALESCE(
        to_char(NEW.appointment_date, 'DD/MM/YYYY'),
        'la fecha programada'
      );

      CASE NEW.status
        WHEN 'confirmed' THEN
          notification_title := '¡Reserva Confirmada!';
          notification_body := format('Tu reserva ha sido confirmada para %s', service_date_text);

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
