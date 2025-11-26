/*
  # Add onboarding_completed field to profiles

  1. Changes
    - Add `onboarding_completed` boolean field to profiles table
    - Default value is false for new users
    - Add `onboarding_completed_at` timestamp field

  2. Security
    - Users can update their own onboarding status
*/

-- Add onboarding_completed field to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
ON profiles(onboarding_completed);

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Users can update own onboarding status" ON profiles;

-- Create policy to allow users to update their own onboarding status
CREATE POLICY "Users can update own onboarding status"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);