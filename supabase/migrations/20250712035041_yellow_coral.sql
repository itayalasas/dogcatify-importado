/*
  # Create pet health records table

  1. New Tables
    - `pet_health`
      - `id` (uuid, primary key)
      - `pet_id` (uuid, references pets)
      - `user_id` (uuid, references profiles)
      - `type` (text) - vaccine, illness, allergy, deworming
      - `name` (text)
      - `application_date` (text)
      - `diagnosis_date` (text)
      - `next_due_date` (text)
      - `veterinarian` (text)
      - `treatment` (text)
      - `symptoms` (text)
      - `severity` (text)
      - `product_name` (text)
      - `notes` (text)
      - `status` (text)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `pet_health` table
    - Add policy for authenticated users to manage their pets' health records
*/

CREATE TABLE IF NOT EXISTS pet_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pets(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  type TEXT NOT NULL,
  name TEXT,
  application_date TEXT,
  diagnosis_date TEXT,
  next_due_date TEXT,
  veterinarian TEXT,
  treatment TEXT,
  symptoms TEXT,
  severity TEXT,
  product_name TEXT,
  notes TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE pet_health ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view any pet health record"
  ON pet_health
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert health records for their pets"
  ON pet_health
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update health records for their pets"
  ON pet_health
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete health records for their pets"
  ON pet_health
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);