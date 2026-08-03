-- Split multi-store product purchases into child orders while keeping the master payment order internal.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid,
  ADD COLUMN IF NOT EXISTS is_split_master boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_stock_sync boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_parent_order_id_fkey
  FOREIGN KEY (parent_order_id)
  REFERENCES public.orders(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_parent_order_id
  ON public.orders (parent_order_id);

CREATE INDEX IF NOT EXISTS idx_orders_is_split_master
  ON public.orders (is_split_master);

ALTER TABLE public.orders
  ADD CONSTRAINT orders_parent_order_partner_unique
  UNIQUE (parent_order_id, partner_id);

CREATE OR REPLACE FUNCTION public.decrease_stock_on_order_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
item JSONB;
product_id UUID;
product_quantity INTEGER;
current_stock INTEGER;
BEGIN
IF COALESCE(NEW.skip_stock_sync, false) OR COALESCE(NEW.is_split_master, false) THEN
  RAISE NOTICE '⏭️ Skipping stock decrement for split/helper order %', NEW.id;
  RETURN NEW;
END IF;

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

CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  item JSONB;
  product_id UUID;
  product_quantity INTEGER;
BEGIN
  IF COALESCE(NEW.skip_stock_sync, false) OR COALESCE(NEW.is_split_master, false) THEN
    RAISE NOTICE '⏭️ Skipping stock restore for split/helper order %', NEW.id;
    RETURN NEW;
  END IF;

  IF OLD.status = 'cancelled' OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.order_type <> 'product_purchase' THEN
    RETURN NEW;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    product_id := (item->>'id')::UUID;
    product_quantity := COALESCE((item->>'quantity')::INTEGER, 1);

    UPDATE partner_products
    SET stock = stock + product_quantity
    WHERE id = product_id;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_order_confirmation_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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
  IF COALESCE(NEW.is_split_master, false) THEN
    RAISE NOTICE '⏭️ Skipping confirmation email for split master order %', NEW.id;
    RETURN NEW;
  END IF;

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
    template_to_use := 'shop_confirmation';

    RAISE NOTICE '🛍️ Product purchase detected - using shop_confirmation template';

    delivery_address_text := COALESCE(NEW.shipping_address, 'Sin dirección especificada');

    payment_method_display := CASE
      WHEN NEW.payment_method = 'mercadopago' THEN 'Mercado Pago'
      WHEN NEW.payment_method = 'cash' THEN 'Efectivo'
      WHEN NEW.payment_method = 'card' THEN 'Tarjeta'
      ELSE INITCAP(NEW.payment_method)
    END;

    email_data := jsonb_build_object(
      'client_name', customer_name_text,
      'order_number', COALESCE(NEW.order_number, '#' || RIGHT(NEW.id::text, 6)),
      'order_date', TO_CHAR(NEW.created_at, 'DD/MM/YYYY'),
      'payment_method', payment_method_display,
      'payment_status', 'Confirmada',
      'delivery_address', delivery_address_text
    );
  END IF;

  payload := jsonb_build_object(
    'template_name', template_to_use,
    'recipient_email', customer_email_text,
    'order_id', NEW.id::text,
    'wait_for_invoice', true,
    'data', email_data
  );

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
      timeout_milliseconds := 15000
    ) INTO request_id;

    RAISE NOTICE '✅ HTTP request queued successfully (request_id: %)', request_id;
    RAISE NOTICE '📧 Order confirmation email queued for order % to %',
      NEW.id, customer_email_text;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ EXCEPTION in HTTP request: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RAISE WARNING '❌ Failed to send confirmation email for order %', NEW.id;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_crm_and_accounting_webhook() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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
  IF COALESCE(NEW.is_split_master, false) THEN
    RAISE NOTICE '⏭️ Skipping CRM/accounting webhook for split master order %', NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND COALESCE(NEW.skip_stock_sync, false) AND NEW.parent_order_id IS NULL THEN
    RAISE NOTICE '⏭️ Skipping CRM/accounting webhook for helper order %', NEW.id;
    RETURN NEW;
  END IF;

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
    'event_type', event_type,
    'triggered_at', now(),
    'order_data', row_to_json(NEW)
  );

  RAISE NOTICE 'Sending CRM webhook for order % (%): %', NEW.id, event_type, function_url;

  BEGIN
    SELECT net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := payload,
      timeout_milliseconds := 15000
    ) INTO request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to enqueue CRM webhook for order %: %', NEW.id, SQLERRM;
  END;

  IF should_send_to_accounting THEN
    accounting_payload := jsonb_build_object(
      'order_id', NEW.id
    );

    BEGIN
      SELECT net.http_post(
        url := accounting_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_service_key
        ),
        body := accounting_payload,
        timeout_milliseconds := 15000
      ) INTO accounting_request_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to enqueue accounting webhook for order %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

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
  IF COALESCE(NEW.is_split_master, false) THEN
    RETURN NEW;
  END IF;

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
