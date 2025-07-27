/*
  # Add push token support to profiles

  1. Changes
    - Add `push_token` column to profiles table for storing Expo push tokens
    - Add `notification_preferences` column for user notification settings
    - Add index for efficient push token lookups

  2. Security
    - Users can only update their own push tokens
    - Admin can view all push tokens for sending notifications
*/

-- Add push token column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS push_token text,
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"push_enabled": true, "email_enabled": true}'::jsonb;

-- Add index for push token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token) WHERE push_token IS NOT NULL;

-- Add index for notification preferences
CREATE INDEX IF NOT EXISTS idx_profiles_notifications ON profiles USING gin(notification_preferences);

-- Update RLS policies to allow users to update their own push tokens
CREATE POLICY IF NOT EXISTS "Users can update own push token"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admin to read all push tokens for sending notifications
CREATE POLICY IF NOT EXISTS "Admin can read all push tokens"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT email FROM profiles WHERE id = auth.uid()) = 'admin@dogcatify.com'
  );