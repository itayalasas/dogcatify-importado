/*
  # Create promotions table

  1. New Tables
    - `promotions`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `image_url` (text)
      - `start_date` (timestamptz)
      - `end_date` (timestamptz)
      - `target_audience` (text)
      - `is_active` (boolean)
      - `views` (integer)
      - `clicks` (integer)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references profiles)
      - `partner_id` (uuid, references partners)
      - `promotion_type` (text)
      - `cta_text` (text)
      - `cta_url` (text)
  2. Security
    - Enable RLS on `promotions` table
    - Add policy for admins to manage promotions
    - Add policy for users to view active promotions
*/

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  target_audience TEXT DEFAULT 'all',
  is_active BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  partner_id UUID REFERENCES partners(id),
  promotion_type TEXT DEFAULT 'general',
  cta_text TEXT DEFAULT 'Más información',
  cta_url TEXT
);

-- Enable Row Level Security
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active promotions"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (is_active = true AND start_date <= now() AND end_date >= now());

CREATE POLICY "Admins can manage all promotions"
  ON promotions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND email = 'admin@dogcatify.com'
    )
  );

CREATE POLICY "Partners can view their own promotions"
  ON promotions
  FOR SELECT
  TO authenticated
  USING (
    partner_id IS NOT NULL AND 
    EXISTS (
      SELECT 1 FROM partners 
      WHERE id = promotions.partner_id 
      AND user_id = auth.uid()
    )
  );