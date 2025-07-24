/*
  # Create business schedule table

  1. New Tables
    - `business_schedule`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, references partners)
      - `day_of_week` (integer)
      - `start_time` (text)
      - `end_time` (text)
      - `max_slots` (integer)
      - `slot_duration` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `business_schedule` table
    - Add policy for authenticated users to manage their business schedule
*/

CREATE TABLE IF NOT EXISTS business_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  max_slots INTEGER DEFAULT 8,
  slot_duration INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE business_schedule ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view business schedules"
  ON business_schedule
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Partners can insert their own schedules"
  ON business_schedule
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can update their own schedules"
  ON business_schedule
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can delete their own schedules"
  ON business_schedule
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));