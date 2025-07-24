/*
  # Add is_shared column to pet_albums table

  1. Changes
    - Add is_shared boolean column to pet_albums table with default value false
*/

-- Add is_shared column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pet_albums' AND column_name = 'is_shared'
  ) THEN
    ALTER TABLE pet_albums ADD COLUMN is_shared BOOLEAN DEFAULT false;
  END IF;
END $$;