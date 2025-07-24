/*
  # Create bookings table

  1. New Tables
    - `bookings`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, references partners)
      - `service_id` (uuid, references partner_services)
      - `service_name` (text)
      - `service_duration` (integer)
      - `partner_name` (text)
      - `customer_id` (uuid, references profiles)
      - `customer_name` (text)
      - `customer_phone` (text)
      - `pet_id` (uuid, references pets)
      - `pet_name` (text)
      - `date` (timestamptz)
      - `time` (text)
      - `end_time` (text)
      - `status` (text)
      - `total_amount` (numeric)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Security
    - Enable RLS on `bookings` table
    - Add policy for authenticated users to manage their bookings
*/

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) NOT NULL,
  service_id UUID REFERENCES partner_services(id),
  service_name TEXT NOT NULL,
  service_duration INTEGER,
  partner_name TEXT,
  customer_id UUID REFERENCES profiles(id) NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  pet_id UUID REFERENCES pets(id) NOT NULL,
  pet_name TEXT,
  date TIMESTAMPTZ NOT NULL,
  time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'pending',
  total_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Customers can view their own bookings"
  ON bookings
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM partners WHERE id = bookings.partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Customers can insert their own bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their own bookings"
  ON bookings
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM partners WHERE id = bookings.partner_id AND user_id = auth.uid()
  ));

CREATE POLICY "Customers can delete their own bookings"
  ON bookings
  FOR DELETE
  TO authenticated
  USING (customer_id = auth.uid() OR EXISTS (
    SELECT 1 FROM partners WHERE id = bookings.partner_id AND user_id = auth.uid()
  ));