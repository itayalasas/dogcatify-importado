/*
  # Create pets table

  1. New Tables
    - `pets`
      - `id` (uuid, primary key)
      - `name` (text)
      - `species` (text)
      - `breed` (text)
      - `breed_info` (jsonb)
      - `age` (numeric)
      - `age_display` (jsonb)
      - `gender` (text)
      - `weight` (numeric)
      - `weight_display` (jsonb)
      - `is_neutered` (boolean)
      - `has_chip` (boolean)
      - `chip_number` (text)
      - `photo_url` (text)
      - `owner_id` (uuid, references profiles)
      - `personality` (text[])
      - `medical_notes` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `pets` table
    - Add policy for authenticated users to read and manage their own pets
*/

CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT NOT NULL,
  breed_info JSONB,
  age NUMERIC,
  age_display JSONB,
  gender TEXT NOT NULL,
  weight NUMERIC,
  weight_display JSONB,
  is_neutered BOOLEAN DEFAULT false,
  has_chip BOOLEAN DEFAULT false,
  chip_number TEXT,
  photo_url TEXT,
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  personality TEXT[] DEFAULT '{}',
  medical_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view any pet"
  ON pets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own pets"
  ON pets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own pets"
  ON pets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own pets"
  ON pets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);