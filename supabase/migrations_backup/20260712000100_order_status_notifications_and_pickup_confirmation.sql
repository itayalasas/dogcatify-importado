-- Order status notifications for both customer and partner, plus pickup confirmation support.

CREATE OR REPLACE FUNCTION public.create_order_status_notification() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  customer_title text;
  customer_body text;
  partner_title text;
  partner_body text;
  fulfillment_mode text;
  is_pickup_order boolean;
  order_ref text;
  partner_owner_id uuid;
  customer_active_tab text;
  partner_active_tab text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  fulfillment_mode := CASE
    WHEN NEW.order_type = 'service_booking' THEN 'service'
    WHEN COALESCE(NEW.shipping_address, '') ILIKE '%retiro%' THEN 'pickup'
    ELSE 'shipping'
  END;
  is_pickup_order := fulfillment_mode = 'pickup';
  order_ref := COALESCE(NULLIF(NEW.order_number, ''), NEW.id::text);

  SELECT p.user_id
    INTO partner_owner_id
  FROM public.partners p
  WHERE p.id = NEW.partner_id
  LIMIT 1;

  customer_active_tab := CASE
    WHEN NEW.status IN ('completed', 'delivered', 'cancelled', 'refunded') THEN 'completed'
    WHEN NEW.status IN ('pending', 'reserved', 'payment_failed') THEN 'pending'
    ELSE 'processing'
  END;

  partner_active_tab := customer_active_tab;

  IF NEW.order_type = 'service_booking' THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        customer_title := 'Reserva confirmada';
        customer_body := format('Tu reserva %s fue confirmada.', order_ref);
        partner_title := 'Reserva confirmada';
        partner_body := format('La reserva %s fue confirmada.', order_ref);
      WHEN 'completed' THEN
        customer_title := 'Servicio completado';
        customer_body := format('Tu servicio %s fue completado.', order_ref);
        partner_title := 'Servicio completado';
        partner_body := format('El servicio %s fue completado.', order_ref);
      WHEN 'cancelled' THEN
        customer_title := 'Reserva cancelada';
        customer_body := format('Tu reserva %s fue cancelada.', order_ref);
        partner_title := 'Reserva cancelada';
        partner_body := format('La reserva %s fue cancelada.', order_ref);
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    CASE NEW.status
      WHEN 'pending' THEN
        customer_title := 'Pedido pendiente';
        customer_body := format('Tu pedido %s quedó pendiente.', order_ref);
        partner_title := 'Pedido pendiente';
        partner_body := format('El pedido %s quedó pendiente.', order_ref);
      WHEN 'reserved' THEN
        customer_title := 'Pedido reservado';
        customer_body := format('Tu pedido %s fue reservado.', order_ref);
        partner_title := 'Pedido reservado';
        partner_body := format('El pedido %s fue reservado.', order_ref);
      WHEN 'payment_failed' THEN
        customer_title := 'Pago fallido';
        customer_body := format('No pudimos confirmar el pago del pedido %s.', order_ref);
        partner_title := 'Pago fallido';
        partner_body := format('El pago del pedido %s falló.', order_ref);
      WHEN 'confirmed' THEN
        customer_title := 'Pedido confirmado';
        customer_body := format('Tu pedido %s fue confirmado.', order_ref);
        partner_title := 'Pedido confirmado';
        partner_body := format('El pedido %s fue confirmado.', order_ref);
      WHEN 'processing' THEN
        customer_title := 'Pedido en proceso';
        customer_body := format('Estamos procesando tu pedido %s.', order_ref);
        partner_title := 'Pedido en proceso';
        partner_body := format('El pedido %s quedó en proceso.', order_ref);
      WHEN 'preparing' THEN
        customer_title := 'Pedido en preparación';
        customer_body := format('Estamos preparando tu pedido %s.', order_ref);
        partner_title := 'Pedido en preparación';
        partner_body := format('El pedido %s quedó en preparación.', order_ref);
      WHEN 'ready_for_delivery' THEN
        IF is_pickup_order THEN
          customer_title := 'Listo para retirar';
          customer_body := format('Tu pedido %s ya está listo para retirar en tienda.', order_ref);
          partner_title := 'Listo para retirar';
          partner_body := format('El pedido %s ya puede ser retirado en tienda.', order_ref);
        ELSE
          customer_title := 'Listo para entrega';
          customer_body := format('Tu pedido %s ya está listo para salir a entrega.', order_ref);
          partner_title := 'Listo para entrega';
          partner_body := format('El pedido %s quedó listo para despacho.', order_ref);
        END IF;
      WHEN 'shipped' THEN
        IF is_pickup_order THEN
          customer_title := 'Pedido actualizado';
          customer_body := format('Tu pedido %s cambió de estado.', order_ref);
          partner_title := 'Pedido actualizado';
          partner_body := format('El pedido %s cambió de estado.', order_ref);
        ELSE
          customer_title := 'En reparto';
          customer_body := format('Tu pedido %s está en camino.', order_ref);
          partner_title := 'En reparto';
          partner_body := format('El pedido %s salió a reparto.', order_ref);
        END IF;
      WHEN 'delivered' THEN
        IF is_pickup_order THEN
          customer_title := 'Pedido retirado';
          customer_body := format('Confirmamos que retiraste tu pedido %s en tienda.', order_ref);
          partner_title := 'Pedido retirado';
          partner_body := format('El cliente confirmó que retiró el pedido %s en tienda.', order_ref);
        ELSE
          customer_title := 'Pedido entregado';
          customer_body := format('Tu pedido %s fue entregado.', order_ref);
          partner_title := 'Pedido entregado';
          partner_body := format('El pedido %s fue entregado al cliente.', order_ref);
        END IF;
      WHEN 'completed' THEN
        customer_title := 'Pedido completado';
        customer_body := format('Tu pedido %s fue completado.', order_ref);
        partner_title := 'Pedido completado';
        partner_body := format('El pedido %s fue completado.', order_ref);
      WHEN 'cancelled' THEN
        customer_title := 'Pedido cancelado';
        customer_body := format('Tu pedido %s fue cancelado.', order_ref);
        partner_title := 'Pedido cancelado';
        partner_body := format('El pedido %s fue cancelado.', order_ref);
      WHEN 'refunded' THEN
        customer_title := 'Pedido reembolsado';
        customer_body := format('Tu pedido %s fue reembolsado.', order_ref);
        partner_title := 'Pedido reembolsado';
        partner_body := format('El pedido %s fue reembolsado.', order_ref);
      ELSE
        RETURN NEW;
    END CASE;
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
  VALUES (
    NEW.customer_id,
    'order_status_change',
    NEW.id,
    'order',
    customer_title,
    customer_body,
    jsonb_build_object(
      'screen', 'OrderDetails',
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'order_type', NEW.order_type,
      'status', NEW.status,
      'status_label', customer_title,
      'fulfillment_mode', fulfillment_mode,
      'recipient_role', 'customer',
      'partner_id', NEW.partner_id,
      'customer_id', NEW.customer_id,
      'active_tab', customer_active_tab
    ),
    now(),
    'pending'
  );

  IF partner_owner_id IS NOT NULL AND partner_owner_id IS DISTINCT FROM NEW.customer_id THEN
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
    VALUES (
      partner_owner_id,
      'order_status_change',
      NEW.id,
      'order',
      partner_title,
      partner_body,
      jsonb_build_object(
        'screen', 'PartnerOrders',
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'order_type', NEW.order_type,
        'status', NEW.status,
        'status_label', partner_title,
        'fulfillment_mode', fulfillment_mode,
        'recipient_role', 'partner',
        'partner_id', NEW.partner_id,
        'customer_id', NEW.customer_id,
        'active_tab', partner_active_tab
      ),
      now(),
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_order_delivery_transitions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_pickup_order boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  is_pickup_order := COALESCE(NEW.shipping_address, '') ILIKE '%retiro%';

  IF NEW.status = 'shipped' THEN
    IF OLD.status <> 'ready_for_delivery' THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.delivery_user_id IS NULL THEN
      RAISE EXCEPTION 'delivery_user_id is required when moving to shipped';
    END IF;

    IF NEW.delivery_started_at IS NULL THEN
      NEW.delivery_started_at := now();
    END IF;
  END IF;

  IF NEW.status = 'delivered' THEN
    IF is_pickup_order THEN
      IF OLD.status NOT IN ('ready_for_delivery', 'shipped') THEN
        RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status;
      END IF;
    ELSE
      IF OLD.status <> 'shipped' THEN
        RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status;
      END IF;

      IF OLD.delivery_user_id IS NULL THEN
        RAISE EXCEPTION 'Cannot deliver order without assigned courier';
      END IF;

      IF NEW.delivery_user_id IS DISTINCT FROM OLD.delivery_user_id THEN
        RAISE EXCEPTION 'Assigned courier cannot be changed when delivering order';
      END IF;
    END IF;

    IF NEW.delivered_at IS NULL THEN
      NEW.delivered_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
