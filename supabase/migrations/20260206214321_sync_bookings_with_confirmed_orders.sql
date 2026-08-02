/*
  # Sync Bookings with Confirmed Orders
  
  ## Problem:
  Bookings remain in "pending" status even though their associated orders are "confirmed".
  This happens when payments are processed through MercadoPago webhooks.
  
  ## Solution:
  1. **Data Fix**: Update all bookings that have confirmed orders but pending status
  2. **Trigger**: Create a trigger to automatically sync booking status when order status changes
  
  ## Changes Made:
  
  1. Data Synchronization
     - Updates all bookings with pending status that have confirmed orders
     - Copies payment details from orders to bookings
  
  2. New Trigger Function
     - `sync_booking_status_on_order_update()`: Automatically updates booking status when order changes
  
  3. New Trigger
     - Fires AFTER UPDATE on orders table
     - Syncs booking status, payment_status, and payment_method with order
  
  ## Security:
  - Trigger runs as SECURITY DEFINER to ensure proper permissions
  - Only syncs when order status actually changes
*/

-- Update all bookings that have confirmed orders but are still pending
UPDATE bookings b
SET 
  status = o.status,
  payment_status = o.payment_status,
  payment_method = COALESCE(b.payment_method, o.payment_method),
  payment_id = COALESCE(b.payment_id, o.payment_id),
  payment_data = COALESCE(b.payment_data, o.payment_data),
  payment_confirmed_at = COALESCE(b.payment_confirmed_at, o.updated_at)
FROM orders o
WHERE o.booking_id = b.id
  AND o.status = 'confirmed'
  AND b.status != 'confirmed';


-- Create trigger function to sync booking status when order is updated
CREATE OR REPLACE FUNCTION sync_booking_status_on_order_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status OR 
     OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    
    -- Update the associated booking
    UPDATE bookings
    SET 
      status = NEW.status,
      payment_status = NEW.payment_status,
      payment_method = COALESCE(bookings.payment_method, NEW.payment_method),
      payment_id = COALESCE(bookings.payment_id, NEW.payment_id),
      payment_data = COALESCE(bookings.payment_data, NEW.payment_data),
      payment_confirmed_at = CASE 
        WHEN NEW.status = 'confirmed' AND bookings.payment_confirmed_at IS NULL 
        THEN NEW.updated_at 
        ELSE bookings.payment_confirmed_at 
      END,
      updated_at = NOW()
    WHERE id = NEW.booking_id;

    
  END IF;

  
  RETURN NEW;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create trigger to sync booking status when order is updated
DROP TRIGGER IF EXISTS trigger_sync_booking_on_order_update ON orders;

CREATE TRIGGER trigger_sync_booking_on_order_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION sync_booking_status_on_order_update();

;


