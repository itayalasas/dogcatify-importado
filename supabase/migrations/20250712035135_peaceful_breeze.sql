/*
  # Create pet albums table

  1. New Tables
    - `pet_albums`
      - `id` (uuid, primary key)
      - `pet_id` (uuid, references pets)
      - `user_id` (uuid, references profiles)
      - `title` (text)
      - `description` (text)
      - `images` (text[])
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `pet_albums` table
    - Add policy for authenticated users to manage their pet albums
*/

CREATE TABLE IF NOT EXISTS pet_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT,
  description TEXT,
  images TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE pet_albums ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view pet albums"
  ON pet_albums
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own pet albums"
  ON pet_albums
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pet albums"
  ON pet_albums
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pet albums"
  ON pet_albums
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);