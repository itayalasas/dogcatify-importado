/*
  # Add Dotty Assistant Visibility Setting

  1. Changes
    - Add `dotty_enabled` column to profiles table
    - Default value: true (Dotty visible by default)
    - Allows users to hide/show Dotty assistant from their profile settings

  2. Security
    - Users can only update their own dotty_enabled setting
*/

-- Add dotty_enabled column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dotty_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dotty_enabled boolean DEFAULT true NOT NULL;

  END IF;

END $$;


-- Update existing users to have Dotty enabled by default
UPDATE profiles SET dotty_enabled = true WHERE dotty_enabled IS NULL;

;


