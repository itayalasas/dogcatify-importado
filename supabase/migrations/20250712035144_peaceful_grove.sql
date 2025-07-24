/*
  # Create user carts table

  1. New Tables
    - `user_carts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `items` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `user_carts` table
    - Add policy for authenticated users to manage their carts
*/

CREATE TABLE IF NOT EXISTS user_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_carts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own cart"
  ON user_carts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cart"
  ON user_carts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cart"
  ON user_carts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cart"
  ON user_carts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);