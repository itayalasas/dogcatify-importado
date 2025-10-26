/*
  # Add payment status detail to orders

  1. Changes
    - Add `payment_status_detail` column to `orders` table to store MP status_detail
    
  2. Notes
    - This field will store values like "accredited", "pending_contingency", etc.
    - Helps with better payment tracking and debugging
*/

-- Add payment_status_detail column to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status_detail'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status_detail text;
    
    COMMENT ON COLUMN orders.payment_status_detail IS 'Detailed payment status from Mercado Pago (e.g., accredited, pending_contingency)';
  END IF;
END $$;