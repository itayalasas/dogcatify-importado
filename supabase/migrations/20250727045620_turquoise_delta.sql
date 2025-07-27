/*
  # Create places table for pet-friendly locations

  1. New Tables
    - `places`
      - `id` (uuid, primary key)
      - `name` (text, not null) - Name of the place
      - `category` (text, not null) - Category (parques, restaurantes, etc.)
      - `address` (text, not null) - Full address
      - `phone` (text, nullable) - Contact phone
      - `rating` (numeric, default 5) - Rating from 1-5
      - `description` (text, not null) - Description of the place
      - `pet_amenities` (text[], default empty array) - Pet services available
      - `image_url` (text, nullable) - Photo of the place
      - `coordinates` (jsonb, nullable) - GPS coordinates {latitude, longitude}
      - `is_active` (boolean, default true) - Active status
      - `created_by` (uuid, nullable) - Admin who created it
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `places` table
    - Add policy for public read access to active places
    - Add policy for admin-only write access
*/

-- Create places table
CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  address text NOT NULL,
  phone text,
  rating numeric DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  description text NOT NULL,
  pet_amenities text[] DEFAULT '{}',
  image_url text,
  coordinates jsonb,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

-- Policy for public read access to active places
CREATE POLICY "Anyone can view active places"
  ON places
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policy for authenticated users to view all places
CREATE POLICY "Authenticated users can view all places"
  ON places
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for admin-only write access
CREATE POLICY "Only admins can manage places"
  ON places
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = 'admin@dogcatify.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = 'admin@dogcatify.com'
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_active ON places(is_active);
CREATE INDEX IF NOT EXISTS idx_places_created_at ON places(created_at);

-- Add foreign key constraint for created_by
ALTER TABLE places 
ADD CONSTRAINT fk_places_created_by 
FOREIGN KEY (created_by) REFERENCES profiles(id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_places_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_places_updated_at
  BEFORE UPDATE ON places
  FOR EACH ROW
  EXECUTE FUNCTION update_places_updated_at();