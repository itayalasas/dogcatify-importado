/*
  # Create profiles table

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique)
      - `display_name` (text)
      - `photo_url` (text)
      - `is_owner` (boolean)
      - `is_partner` (boolean)
      - `location` (text)
      - `bio` (text)
      - `phone` (text)
      - `followers` (text[])
      - `following` (text[])
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `profiles` table
    - Add policy for authenticated users to read their own data
*/

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  photo_url TEXT,
  is_owner BOOLEAN DEFAULT true,
  is_partner BOOLEAN DEFAULT false,
  location TEXT,
  bio TEXT,
  phone TEXT,
  followers TEXT[] DEFAULT '{}',
  following TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view any profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Create a trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, created_at, updated_at)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name', now(), now());
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();