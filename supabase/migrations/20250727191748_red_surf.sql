/*
  # Sistema de facturación por promociones

  1. Nueva tabla promotion_billing
    - `id` (uuid, primary key)
    - `promotion_id` (uuid, foreign key)
    - `partner_id` (uuid, foreign key) 
    - `total_clicks` (integer)
    - `cost_per_click` (numeric)
    - `total_amount` (numeric)
    - `billing_period_start` (timestamp)
    - `billing_period_end` (timestamp)
    - `status` (text) - pending, paid, cancelled
    - `invoice_number` (text)
    - `created_at` (timestamp)
    - `paid_at` (timestamp)

  2. Seguridad
    - Enable RLS on promotion_billing table
    - Add policies for admin access
*/

CREATE TABLE IF NOT EXISTS promotion_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  total_clicks integer NOT NULL DEFAULT 0,
  cost_per_click numeric(10,2) NOT NULL DEFAULT 100.00,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invoice_number text UNIQUE,
  notes text,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  created_by uuid REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE promotion_billing ENABLE ROW LEVEL SECURITY;

-- Admin can manage all billing records
CREATE POLICY "Admin can manage all promotion billing"
  ON promotion_billing
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

-- Partners can view their own billing records
CREATE POLICY "Partners can view their own billing"
  ON promotion_billing
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = promotion_billing.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
BEGIN
  RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('invoice_sequence')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_sequence START 1;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_promotion_billing_promotion_id ON promotion_billing(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_billing_partner_id ON promotion_billing(partner_id);
CREATE INDEX IF NOT EXISTS idx_promotion_billing_status ON promotion_billing(status);