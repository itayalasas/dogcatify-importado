/*
  # Create partner products table

  1. New Tables
    - `partner_products`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, references partners)
      - `name` (text)
      - `description` (text)
      - `category` (text)
      - `price` (numeric)
      - `stock` (integer)
      - `brand` (text)
      - `weight` (text)
      - `size` (text)
      - `color` (text)
      - `age_range` (text)
      - `pet_type` (text)
      - `is_active` (boolean)
      - `images` (text[])
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `partner_products` table
    - Add policy for authenticated users to manage their products
*/

CREATE TABLE IF NOT EXISTS partner_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  price NUMERIC NOT NULL,
  stock INTEGER DEFAULT 0,
  brand TEXT,
  weight TEXT,
  size TEXT,
  color TEXT,
  age_range TEXT,
  pet_type TEXT,
  is_active BOOLEAN DEFAULT true,
  images TEXT[] DEFAULT '{}',
  partner_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE partner_products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active products"
  ON partner_products
  FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM partners WHERE id = partner_products.partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can insert their own products"
  ON partner_products
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can update their own products"
  ON partner_products
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Partners can delete their own products"
  ON partner_products
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ));