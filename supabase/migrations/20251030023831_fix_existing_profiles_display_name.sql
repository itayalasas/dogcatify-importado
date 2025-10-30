/*
  # Fix existing profiles without display_name

  1. Changes
    - Updates all existing profiles that have NULL display_name
    - Copies the full_name from auth.users metadata to profiles.display_name
  
  2. Notes
    - This is a one-time fix for existing users
    - New users will have their display_name set automatically by the trigger
*/

-- Update existing profiles with display_name from auth.users metadata
UPDATE public.profiles p
SET display_name = COALESCE(au.raw_user_meta_data->>'full_name', '')
FROM auth.users au
WHERE p.id = au.id
  AND p.display_name IS NULL
  AND au.raw_user_meta_data->>'full_name' IS NOT NULL;
