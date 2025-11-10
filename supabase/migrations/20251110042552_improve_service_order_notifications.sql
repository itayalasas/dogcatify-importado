/*
  # Mejorar Notificaciones de Órdenes de Servicios

  1. Cambios
    - Actualizar `create_order_status_notification()` para diferenciar mensajes entre:
      - Órdenes de productos: pasan por estados de preparación, envío, entrega
      - Órdenes de servicios: son reservas que se confirman directamente

  2. Mensajes para Servicios (Reservas)
    - `confirmed`: "¡Reserva Confirmada!" - "Tu reserva ha sido confirmada para [fecha]"
    - `completed`: "Servicio Completado" - "Tu servicio ha sido completado. ¡Gracias!"
    - `cancelled`: "Reserva Cancelada" - "Tu reserva ha sido cancelada"
    - Estados no aplicables para servicios: preparing, ready, shipped, delivered

  3. Mensajes para Productos (Pedidos)
    - Mantener los mensajes actuales que incluyen preparación, envío, etc.

  4. Notas
    - Los servicios solo usan estados: pending → confirmed → completed (o cancelled)
    - Los productos pueden usar todos los estados del flujo completo
*/

CREATE OR REPLACE FUNCTION create_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_body text;
  order_type_text text;
  service_date text;
BEGIN
  -- Solo notificar si el estado cambió
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- Si es un servicio (reserva)
    IF NEW.order_type = 'service' THEN

      -- Obtener fecha del servicio si existe
      service_date := COALESCE(
        to_char(NEW.service_date, 'DD/MM/YYYY'),
        'la fecha programada'
      );

      CASE NEW.status
        WHEN 'confirmed' THEN
          notification_title := '¡Reserva Confirmada!';
          notification_body := format('Tu reserva ha sido confirmada para %s', service_date);

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
    ELSE

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
