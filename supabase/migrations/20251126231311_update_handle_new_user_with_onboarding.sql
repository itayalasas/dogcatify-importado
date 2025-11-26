/*
  # Update handle_new_user to include onboarding fields

  1. Changes
    - Update handle_new_user function to set onboarding_completed to false for new users
    - Ensures new users see the onboarding flow

  2. Security
    - Maintains SECURITY DEFINER for bypassing RLS
*/

-- Update function to include onboarding_completed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    display_name, 
    is_owner, 
    is_partner, 
    email_confirmed,
    email_confirmed_at,
    onboarding_completed,
    followers,
    following,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    true,
    false,
    NEW.email_confirmed_at IS NOT NULL,
    NEW.email_confirmed_at,
    false,
    ARRAY[]::text[],
    ARRAY[]::text[],
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
