/*
  # Fix Booking Reminder Function
  
  ## Problem:
  The function `create_booking_reminder_notification()` references a constraint 
  `idx_unique_booking_reminder` that doesn't exist, causing booking updates to fail.
  
  ## Solution:
  1. Create a unique index for booking reminders
  2. Update the function to not rely on a named constraint
  
  ## Changes:
  
  1. New Unique Index
     - `idx_unique_booking_reminder`: Partial unique index for booking reminders
     - Prevents duplicate notifications for the same pending booking reminder
  
  2. Updated Function
     - Removes the ON CONFLICT ON CONSTRAINT clause
     - Uses simple INSERT with no conflict handling (index prevents duplicates automatically)
  
  ## Security:
  - No security implications, just fixes data integrity
*/

-- Create unique index for booking reminders if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_booking_reminder 
ON scheduled_notifications (reference_id, notification_type)
WHERE reference_type = 'booking' AND notification_type = 'booking_reminder' AND status = 'pending';


-- Update the function to not use ON CONFLICT with constraint name
CREATE OR REPLACE FUNCTION create_booking_reminder_notification()
RETURNS TRIGGER AS $$
DECLARE
  reminder_time timestamptz;

  pet_name_text text;

  service_name_text text;

BEGIN
  IF NEW.payment_status = 'approved' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'approved') THEN
    
    reminder_time := NEW.date - interval '24 hours';

    
    IF reminder_time > now() THEN
      
      pet_name_text := COALESCE(NEW.pet_name, 'tu mascota');

      service_name_text := COALESCE(NEW.service_name, 'servicio');

      
      -- Insert only if not exists (unique index prevents duplicates)
      INSERT INTO scheduled_notifications (
        user_id,
        notification_type,
        reference_id,
        reference_type,
        title,
        body,
        data,
        scheduled_for,
        status
      ) 
      SELECT
        NEW.customer_id,
        'booking_reminder',
        NEW.id,
        'booking',
        'Â¡Recordatorio de Reserva!',
        format('MaÃ±ana tienes una cita de %s para %s a las %s', 
          service_name_text, 
          pet_name_text, 
          NEW.time
        ),
        jsonb_build_object(
          'booking_id', NEW.id,
          'service_name', NEW.service_name,
          'pet_name', NEW.pet_name,
          'date', NEW.date,
          'time', NEW.time,
          'partner_name', NEW.partner_name,
          'screen', 'BookingDetails'
        ),
        reminder_time,
        'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM scheduled_notifications
        WHERE reference_id = NEW.id
          AND reference_type = 'booking'
          AND notification_type = 'booking_reminder'
          AND status = 'pending'
      );

    END IF;

  END IF;

  
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    UPDATE scheduled_notifications
    SET status = 'cancelled', updated_at = now()
    WHERE reference_id = NEW.id 
      AND reference_type = 'booking'
      AND notification_type = 'booking_reminder'
      AND status = 'pending';

  END IF;

  
  RETURN NEW;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;

;


