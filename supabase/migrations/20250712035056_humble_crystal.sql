/*
  # Create partners table

  1. New Tables
    - `partners`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `business_name` (text)
      - `business_type` (text)
      - `description` (text)
      - `address` (text)
      - `phone` (text)
      - `email` (text)
      - `logo` (text)
      - `images` (text[])
      - `is_active` (boolean)
      - `is_verified` (boolean)
      - `rating` (numeric)
      - `reviews_count` (integer)
      - `features` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `partners` table
    - Add policy for authenticated users to manage their partner profiles
*/

CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo TEXT,
  images TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  rating NUMERIC DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view verified partners"
  ON partners
  FOR SELECT
  TO authenticated
  USING (is_verified = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own partner profiles"
  ON partners
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own partner profiles"
  ON partners
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own partner profiles"
  ON partners
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);