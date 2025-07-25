/*
  # Add shipping configuration to partners table

  1. Changes
    - Add has_shipping boolean column to partners table
    - Add shipping_cost numeric column to partners table
*/

-- Add has_shipping column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'partners' AND column_name = 'has_shipping'
  ) THEN
    ALTER TABLE partners ADD COLUMN has_shipping BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add shipping_cost column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'partners' AND column_name = 'shipping_cost'
  ) THEN
    ALTER TABLE partners ADD COLUMN shipping_cost NUMERIC DEFAULT 0;
  END IF;
END $$;