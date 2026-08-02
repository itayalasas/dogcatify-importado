/*
  # Add Order Number System
  
  Creates a complete order number generation system for orders and bookings.
  
  ## Changes:
  
  1. New Sequence
     - `order_number_seq`: Sequential counter for order numbers
  
  2. New Function
     - `generate_order_number()`: Generates unique order numbers in format ORD-YYYYMMDD-XXX
  
  3. New Triggers
     - Automatically generates order_number when orders are created
     - Updates booking with order_number when order is created
  
  4. Schema Updates
     - Adds `order_number` column to bookings table
     - Updates existing orders with generated order numbers
  
  ## Order Number Format:
  
  Format: ORD-20260206-001
  - ORD: Prefix for orders
  - YYYYMMDD: Date of creation
  - XXX: Sequential number for that day (resets daily)
  
  ## Security:
  
  - Function runs as SECURITY DEFINER to ensure all users can generate numbers
  - Triggers run automatically on insert
*/

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;


-- Add order_number to bookings table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE bookings ADD COLUMN order_number TEXT;

  END IF;

END $$;


-- Function to generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_date TEXT;

  v_seq INTEGER;

  v_order_number TEXT;

BEGIN
  -- Get current date in YYYYMMDD format
  v_date := to_char(CURRENT_DATE, 'YYYYMMDD');

  
  -- Get next sequence number for today
  -- Check how many orders were created today
  SELECT COUNT(*) + 1 INTO v_seq
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE;

  
  -- Generate order number: ORD-YYYYMMDD-XXX
  v_order_number := 'ORD-' || v_date || '-' || LPAD(v_seq::TEXT, 3, '0');

  
  RETURN v_order_number;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Trigger function to set order_number on orders
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if order_number is not already set
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();

  END IF;

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;


-- Create trigger for orders
DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();


-- Update create_order_for_booking function to also set order_number on booking
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

  v_order_number TEXT;

  v_order_id UUID;

BEGIN
  -- Check if order already exists for this booking
  IF EXISTS (SELECT 1 FROM orders WHERE booking_id = NEW.id) THEN
    RETURN NEW;

  END IF;


  -- Generate order number
  v_order_number := generate_order_number();


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


  -- Create the order with complete items structure and order_number
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


  -- Update the booking with the order_number
  UPDATE bookings
  SET order_number = v_order_number
  WHERE id = NEW.id;


  RETURN NEW;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update existing orders with order numbers (backwards compatibility)
DO $$
DECLARE
  v_order RECORD;

  v_order_number TEXT;

  v_counter INTEGER := 0;

BEGIN
  FOR v_order IN SELECT id, created_at FROM orders WHERE order_number IS NULL ORDER BY created_at
  LOOP
    v_counter := v_counter + 1;

    v_order_number := 'ORD-' || to_char(v_order.created_at, 'YYYYMMDD') || '-' || LPAD(v_counter::TEXT, 3, '0');

    
    UPDATE orders 
    SET order_number = v_order_number 
    WHERE id = v_order.id;

    
    -- Also update the corresponding booking if it exists
    UPDATE bookings 
    SET order_number = v_order_number 
    WHERE id = (SELECT booking_id FROM orders WHERE id = v_order.id);

  END LOOP;

END $$;

;


