/*
  # Auto-create user profile on signup

  1. Changes
    - Creates a trigger function that automatically creates a profile when a user signs up
    - The function takes the full_name from auth.users metadata and sets it as display_name
    - Creates a trigger that fires after INSERT on auth.users
  
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS policies
    - Only creates profile if one doesn't exist (prevents duplicates)
*/

-- Create function to automatically create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, is_owner, is_partner, email_confirmed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    true,
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
