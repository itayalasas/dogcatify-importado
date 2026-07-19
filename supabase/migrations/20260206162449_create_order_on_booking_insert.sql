/*
  # Create Order Automatically on Booking Insert
  
  This migration creates a trigger that automatically creates an order when a booking is created.
  This ensures that orders are always created immediately when a booking is made, regardless of payment method.
  
  ## What it does:
  
  1. Creates a function `create_order_for_booking()` that:
     - Gets the partner's commission percentage
     - Calculates IVA, commission, and partner amounts
     - Creates partner_breakdown JSON structure
     - Inserts a new order with all required fields
     - Sets order status based on payment method (pending for payment_link, confirmed for others)
  
  2. Creates a trigger `booking_create_order` that:
     - Fires AFTER INSERT on bookings table
     - Calls the create_order_for_booking() function
     - Only creates order if one doesn't already exist for this booking
  
  ## Important Notes:
  
  - Orders created via payment_link will have status 'pending' until payment is confirmed
  - Orders created via cash/card/transfer will have status 'confirmed' immediately
  - The webhook will update the order with payment details when payment is received
  - The IVA rate is set to 22%
  - Commission percentage comes from the partner's record, defaulting to 5% if not set
*/

-- Create function to automatically create an order when a booking is created
CREATE OR REPLACE FUNCTION create_order_for_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_percentage NUMERIC;

  v_commission_amount NUMERIC;

  v_partner_amount NUMERIC;

  v_iva_amount NUMERIC;

  v_partner_breakdown JSONB;

  v_order_status TEXT;

  v_payment_status TEXT;

  v_iva_rate NUMERIC := 22;

BEGIN
  -- Check if order already exists for this booking
  IF EXISTS (SELECT 1 FROM orders WHERE booking_id = NEW.id) THEN
    RETURN NEW;

  END IF;


  -- Get partner commission percentage
  SELECT commission_percentage INTO v_commission_percentage
  FROM partners
  WHERE id = NEW.partner_id;


  -- Default to 5% if not set
  v_commission_percentage := COALESCE(v_commission_percentage, 5);


  -- Calculate amounts
  v_commission_amount := (NEW.total_amount * v_commission_percentage) / 100;

  v_partner_amount := NEW.total_amount - v_commission_amount;

  v_iva_amount := (NEW.total_amount * v_iva_rate) / 100;


  -- Set order status based on payment method
  IF NEW.payment_method = 'payment_link' THEN
    v_order_status := 'pending';

    v_payment_status := 'pending';

  ELSE
    v_order_status := 'confirmed';

    v_payment_status := COALESCE(NEW.payment_status, 'approved');

  END IF;


  -- Build partner breakdown JSON
  v_partner_breakdown := jsonb_build_object(
    'iva_rate', v_iva_rate,
    'partners', jsonb_build_object(
      NEW.partner_id::text, jsonb_build_object(
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
        'subtotal', NEW.total_amount,
        'partner_id', NEW.partner_id,
        'partner_name', COALESCE(NEW.partner_name, 'Partner')
      )
    ),
    'iva_amount', v_iva_amount,
    'iva_included', false,
    'shipping_cost', 0,
    'total_partners', 1,
    'commission_split', v_commission_amount
  );


  -- Create the order
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
    items
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
    jsonb_build_array(
      jsonb_build_object(
        'id', COALESCE(NEW.service_id::text, NEW.id::text),
        'name', COALESCE(NEW.service_name, 'Servicio'),
        'price', NEW.total_amount,
        'quantity', 1
      )
    )
  );


  RETURN NEW;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create trigger to automatically create order when booking is created
DROP TRIGGER IF EXISTS booking_create_order ON bookings;

CREATE TRIGGER booking_create_order
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_order_for_booking();

;


