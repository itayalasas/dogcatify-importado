/*
  # Update Order Items Structure for Accounting System
  
  Updates the create_order_for_booking() function to generate a complete items array
  that includes all fields required by the accounting system.
  
  ## Changes:
  
  1. Items array now includes complete fiscal information:
     - type: "service" 
     - currency: "UYU"
     - currency_code_dgi: "858" (Uruguay)
     - iva_rate: 22
     - quantity: 1
     - price: service price
     - subtotal: price * quantity
     - iva_amount: (subtotal * iva_rate) / 100
     - partnerId: partner UUID
     - partnerName / partner_name: partner business name
     - original_price: original price (before discounts)
     - discount_percentage: 0 (default)
  
  2. This structure ensures the send-order-to-accounting function has all data needed
  
  ## Example Items Structure:
  
  ```json
  [
    {
      "id": "service-uuid",
      "name": "Servicio Name",
      "type": "service",
      "price": 530,
      "currency": "UYU",
      "currency_code_dgi": "858",
      "iva_rate": 22,
      "quantity": 1,
      "subtotal": 530,
      "iva_amount": 116.6,
      "partnerId": "partner-uuid",
      "partnerName": "Partner Name",
      "partner_name": "Partner Name",
      "original_price": 530,
      "discount_percentage": 0
    }
  ]
  ```
*/

-- Update function to include complete items structure
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

  v_items JSONB;

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


  -- Build complete items array with all accounting fields
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


  -- Create the order with complete items structure
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
    v_items
  );


  RETURN NEW;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;

;


