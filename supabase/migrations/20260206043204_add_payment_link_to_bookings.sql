/*
  # Add payment_link column to bookings table

  1. Changes
    - Add payment_link column to bookings table to store Mercado Pago payment links
  
  2. Notes
    - Column is nullable as it's only used when payment_method is 'payment_link'
    - No default value needed
*/

-- Add payment_link column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_link'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_link text;

  END IF;

END $$;

;


