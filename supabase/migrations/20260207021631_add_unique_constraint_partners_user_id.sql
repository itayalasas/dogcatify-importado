/*
  # Add UNIQUE constraint to partners.user_id

  This migration adds a UNIQUE constraint to the user_id column in the partners table
  to ensure that each user can only have one partner record.

  ## Changes
  1. Add UNIQUE constraint to user_id column in partners table
  
  ## Security
  - This constraint ensures data integrity by preventing duplicate partner records per user
*/

DO $$
BEGIN
  -- Add UNIQUE constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'partners_user_id_unique' 
    AND conrelid = 'partners'::regclass
  ) THEN
    ALTER TABLE partners 
    ADD CONSTRAINT partners_user_id_unique UNIQUE (user_id);

  END IF;

END $$;

;


