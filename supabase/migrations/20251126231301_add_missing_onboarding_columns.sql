/*
  # Add onboarding columns to profiles

  1. Changes
    - Add onboarding_completed column (boolean, default false)
    - Add onboarding_completed_at column (timestamptz, nullable)

  2. Notes
    - These columns track whether user has completed the onboarding flow
    - All existing users will have onboarding_completed set to true (they bypassed onboarding)
*/

-- Add onboarding_completed column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN onboarding_completed boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add onboarding_completed_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN onboarding_completed_at timestamptz;
  END IF;
END $$;

-- Set onboarding_completed to true for existing users
-- (they already bypassed onboarding by logging in)
UPDATE public.profiles 
SET 
  onboarding_completed = true,
  onboarding_completed_at = created_at
WHERE onboarding_completed = false;
