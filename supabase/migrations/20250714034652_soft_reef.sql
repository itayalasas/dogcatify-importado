/*
  # Add weight tracking support to pet_health table

  1. Changes
    - Ensure pet_health table has weight-related columns
    - Add weight, weight_unit fields for weight tracking
*/

-- Add weight and weight_unit columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pet_health' AND column_name = 'weight'
  ) THEN
    ALTER TABLE pet_health ADD COLUMN weight TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pet_health' AND column_name = 'weight_unit'
  ) THEN
    ALTER TABLE pet_health ADD COLUMN weight_unit TEXT;
  END IF;
END $$;