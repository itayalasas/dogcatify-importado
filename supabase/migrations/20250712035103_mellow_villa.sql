/*
  # Create partner services table

  1. New Tables
    - `partner_services`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, references partners)
      - `name` (text)
      - `description` (text)
      - `category` (text)
      - `price` (numeric)
      - `duration` (integer)
      - `is_active` (boolean)
      - `images` (text[])
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `partner_services` table
    - Add policy for authenticated users to manage their services
*/

CREATE TABLE IF NOT EXISTS partner_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC NOT NULL,
  duration INTEGER,
  is_active BOOLEAN DEFAULT true,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE partner_services ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active services"
  ON partner_services
  FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM partners WHERE id = partner_services.partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can insert their own services"
  ON partner_services
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can update their own services"
  ON partner_services
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can delete their own services"
  ON partner_services
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));