/*
  # Add 'reserved' status to orders table

  1. Changes
    - Add 'reserved' as a valid status value to the orders_status_check constraint
    - This status is used for service bookings that are pending payment confirmation
  
  2. Notes
    - Status flow: pending -> reserved (booking held) -> confirmed (payment received)
    - 'reserved' is specifically for service bookings with payment pending
*/

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the constraint with 'reserved' included
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'pending',
    'payment_failed',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'insufficient_stock',
    'reserved'
  ));
