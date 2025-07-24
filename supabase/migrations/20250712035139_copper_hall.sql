/*
  # Create pet behavior table

  1. New Tables
    - `pet_behavior`
      - `id` (uuid, primary key)
      - `pet_id` (uuid, references pets)
      - `user_id` (uuid, references profiles)
      - `traits` (jsonb)
      - `assessment_date` (timestamptz)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `pet_behavior` table
    - Add policy for authenticated users to manage their pet behavior assessments
*/

CREATE TABLE IF NOT EXISTS pet_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  traits JSONB NOT NULL,
  assessment_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE pet_behavior ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view pet behavior assessments"
  ON pet_behavior
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own pet behavior assessments"
  ON pet_behavior
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pet behavior assessments"
  ON pet_behavior
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pet behavior assessments"
  ON pet_behavior
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);