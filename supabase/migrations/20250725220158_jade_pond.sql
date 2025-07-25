/*
  # Add missing payment columns to orders table

  1. Changes
    - Add payment_preference_id column for Mercado Pago preference ID
    - Add payment_id column for Mercado Pago payment ID  
    - Add payment_status column for payment status tracking
    - Add payment_data column for storing payment response data
    - Add commission_amount column for marketplace commission
    - Add partner_amount column for partner earnings
    - Add payment_method column for payment method used
*/

-- Add payment_preference_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_preference_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_preference_id TEXT;
  END IF;
END $$;

-- Add payment_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_id TEXT;
  END IF;
END $$;

-- Add payment_status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status TEXT;
  END IF;
END $$;

-- Add payment_data column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_data'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_data JSONB;
  END IF;
END $$;

-- Add commission_amount column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN commission_amount NUMERIC;
  END IF;
END $$;

-- Add partner_amount column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'partner_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN partner_amount NUMERIC;
  END IF;
END $$;

-- Add payment_method column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method TEXT;
  END IF;
END $$;