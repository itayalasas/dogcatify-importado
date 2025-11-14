/*
  # Add order_number to orders table

  1. Changes
    - Add `order_number` column to `orders` table to store the CRM-generated order number
    - The order number is returned by the CRM after the first webhook call (order.created event)
    - This allows tracking and referencing orders between our system and the CRM

  2. Details
    - Column: `order_number` (text, nullable)
    - No default value since it's assigned by the CRM after order creation
*/

-- Add order_number column to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_number text;
    
    -- Add comment to document the column
    COMMENT ON COLUMN orders.order_number IS 'CRM-generated order number returned after order.created webhook (e.g., DC-1763093357260)';
  END IF;
END $$;
