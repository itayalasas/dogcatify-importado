/*
  # Update Order Trigger to Include Partner Fiscal Data
  
  Updates the create_order_for_booking() function to include complete partner fiscal information
  in the partner_breakdown JSON. This prevents the send-order-to-accounting function from having
  to make additional queries to get partner details.
  
  ## Changes:
  
  1. Fetches additional partner data (RUT, email, phone, address) from partners table
  2. Includes this data in the partner_breakdown JSON structure
  3. This ensures all data needed by accounting systems is available in the order
  
  ## Partner Breakdown Structure:
  
  ```json
  {
    "iva_rate": 22,
    "partners": {
      "partner-uuid": {
        "partner_id": "partner-uuid",
        "partner_name": "Partner Name",
        "partner_rut": "123456789012",
        "partner_email": "partner@example.com",
        "partner_phone": "099123456",
        "partner_address": "Street 123",
        "items": [...],
        "subtotal": 350
      }
    },
    "iva_amount": 77,
    "iva_included": false,
    "shipping_cost": 0,
    "total_partners": 1,
    "commission_split": 17.5
  }
  ```
*/

-- Update function to include partner fiscal data in breakdown
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

  v_partner_rut TEXT;

  v_partner_email TEXT;

  v_partner_phone TEXT;

  v_partner_address TEXT;

BEGIN
  -- Check if order already exists for this booking
  IF EXISTS (SELECT 1 FROM orders WHERE booking_id = NEW.id) THEN
    RETURN NEW;

  END IF;


  -- Get partner data including fiscal information
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


  -- Default to 5% if commission not set
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


  -- Build partner breakdown JSON with fiscal data
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

;


