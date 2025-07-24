/*
  # Create orders table

  1. New Tables
    - `orders`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, references partners)
      - `customer_id` (uuid, references profiles)
      - `items` (jsonb)
      - `status` (text)
      - `total_amount` (numeric)
      - `shipping_address` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `orders` table
    - Add policy for authenticated users to manage their orders
*/

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) NOT NULL,
  customer_id UUID REFERENCES profiles(id) NOT NULL,
  items JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  total_amount NUMERIC NOT NULL,
  shipping_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Customers can view their own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM partners WHERE id = orders.partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Customers can insert their own orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Partners can update orders for their business"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ) OR customer_id = auth.uid());

CREATE POLICY "Partners can delete orders for their business"
  ON orders
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM partners WHERE id = partner_id AND user_id = auth.uid()
  ) OR customer_id = auth.uid());