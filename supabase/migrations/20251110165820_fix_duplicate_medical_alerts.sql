/*
  # Fix Duplicate Medical Alerts

  1. Changes
    - Add unique constraint to prevent duplicate alerts
    - Drop conflicting generate_medical_alerts function
    - Keep only the trigger-based version
    - Improve alert generation to check for existing alerts

  2. Unique Constraint
    - Based on: pet_id, title, due_date, status
    - Only applies to pending/active alerts
    - Allows same alert after completion

  3. Security
    - No RLS changes needed
*/

-- Drop the function that takes pet_id_param (causes duplicates)
DROP FUNCTION IF EXISTS generate_medical_alerts(uuid);

-- Add unique constraint to prevent duplicate pending alerts
-- This prevents the same alert from being created multiple times
CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_alerts_unique_pending
ON medical_alerts (pet_id, title, due_date, status)
WHERE status = 'pending';

-- Improve the trigger function to check for existing alerts before inserting
CREATE OR REPLACE FUNCTION generate_medical_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pet_record RECORD;
  alert_date DATE;
  alert_title TEXT;
  alert_description TEXT;
  alert_priority TEXT := 'medium';
  existing_alert_count INTEGER;
BEGIN
  -- Get pet information
  SELECT * INTO pet_record FROM pets WHERE id = NEW.pet_id;
  
  IF NOT FOUND THEN
    RAISE WARNING 'Pet not found for health record %', NEW.id;
    RETURN NEW;
  END IF;
  
  -- Generate alerts based on health record type
  CASE NEW.type
    WHEN 'vaccine' THEN
      -- Generate next vaccination alert if next_due_date is provided
      IF NEW.next_due_date IS NOT NULL AND NEW.next_due_date != '' THEN
        BEGIN
          -- Parse date in dd/mm/yyyy format
          alert_date := to_date(NEW.next_due_date, 'DD/MM/YYYY');
          
          -- Create alert 7 days before due date
          alert_date := alert_date - INTERVAL '7 days';
          
          -- Only create alert if it's in the future
          IF alert_date > CURRENT_DATE THEN
            alert_title := 'Refuerzo de vacuna: ' || COALESCE(NEW.name, 'Vacuna');
            alert_description := 'Es hora del refuerzo de ' || COALESCE(NEW.name, 'vacuna') || ' para ' || pet_record.name;
            
            -- Core vaccines have higher priority
            IF NEW.name ILIKE '%DHPP%' OR NEW.name ILIKE '%rabia%' OR NEW.name ILIKE '%triple%' THEN
              alert_priority := 'high';
            END IF;
            
            -- Check if alert already exists
            SELECT COUNT(*) INTO existing_alert_count
            FROM medical_alerts
            WHERE pet_id = NEW.pet_id
              AND title = alert_title
              AND due_date = alert_date
              AND status = 'pending';
            
            -- Only insert if doesn't exist
            IF existing_alert_count = 0 THEN
              INSERT INTO medical_alerts (
                pet_id,
                user_id,
                alert_type,
                title,
                description,
                due_date,
                priority,
                status,
                related_record_id,
                metadata
              ) VALUES (
                NEW.pet_id,
                NEW.user_id,
                'vaccine',
                alert_title,
                alert_description,
                alert_date,
                alert_priority,
                'pending',
                NEW.id,
                jsonb_build_object(
                  'vaccine_name', NEW.name,
                  'last_application', NEW.application_date,
                  'veterinarian', NEW.veterinarian
                )
              )
              ON CONFLICT ON CONSTRAINT idx_medical_alerts_unique_pending DO NOTHING;
            END IF;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Error parsing vaccine date %: %', NEW.next_due_date, SQLERRM;
        END;
      END IF;
      
    WHEN 'deworming' THEN
      -- Generate next deworming alert
      IF NEW.next_due_date IS NOT NULL AND NEW.next_due_date != '' THEN
        BEGIN
          alert_date := to_date(NEW.next_due_date, 'DD/MM/YYYY');
          alert_date := alert_date - INTERVAL '3 days'; -- 3 days before for deworming
          
          IF alert_date > CURRENT_DATE THEN
            alert_title := 'Desparasitación pendiente';
            alert_description := 'Es hora de desparasitar a ' || pet_record.name;
            
            -- Check if alert already exists
            SELECT COUNT(*) INTO existing_alert_count
            FROM medical_alerts
            WHERE pet_id = NEW.pet_id
              AND title = alert_title
              AND due_date = alert_date
              AND status = 'pending';
            
            IF existing_alert_count = 0 THEN
              INSERT INTO medical_alerts (
                pet_id,
                user_id,
                alert_type,
                title,
                description,
                due_date,
                priority,
                status,
                related_record_id,
                metadata
              ) VALUES (
                NEW.pet_id,
                NEW.user_id,
                'deworming',
                alert_title,
                alert_description,
                alert_date,
                'medium',
                'pending',
                NEW.id,
                jsonb_build_object(
                  'product_name', NEW.product_name,
                  'last_application', NEW.application_date
                )
              )
              ON CONFLICT ON CONSTRAINT idx_medical_alerts_unique_pending DO NOTHING;
            END IF;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            RAISE WARNING 'Error parsing deworming date %: %', NEW.next_due_date, SQLERRM;
        END;
      END IF;
      
    WHEN 'illness' THEN
      -- Generate checkup reminder for chronic conditions
      IF NEW.status = 'active' THEN
        alert_date := CURRENT_DATE + INTERVAL '3 months';
        alert_title := 'Revisión médica: ' || COALESCE(NEW.name, 'Condición');
        alert_description := 'Revisión de seguimiento para ' || COALESCE(NEW.name, 'condición médica') || ' de ' || pet_record.name;
        
        -- Check if alert already exists
        SELECT COUNT(*) INTO existing_alert_count
        FROM medical_alerts
        WHERE pet_id = NEW.pet_id
          AND title = alert_title
          AND due_date = alert_date
          AND status = 'pending';
        
        IF existing_alert_count = 0 THEN
          INSERT INTO medical_alerts (
            pet_id,
            user_id,
            alert_type,
            title,
            description,
            due_date,
            priority,
            status,
            related_record_id,
            metadata
          ) VALUES (
            NEW.pet_id,
            NEW.user_id,
            'checkup',
            alert_title,
            alert_description,
            alert_date,
            'medium',
            'pending',
            NEW.id,
            jsonb_build_object(
              'condition_name', NEW.name,
              'diagnosis_date', NEW.diagnosis_date
            )
          )
          ON CONFLICT ON CONSTRAINT idx_medical_alerts_unique_pending DO NOTHING;
        END IF;
      END IF;
  END CASE;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the health record creation
    RAISE WARNING 'Error generating medical alerts for health record %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trigger_medical_alerts_on_health_insert ON pet_health;
CREATE TRIGGER trigger_medical_alerts_on_health_insert
  AFTER INSERT ON pet_health
  FOR EACH ROW
  EXECUTE FUNCTION generate_medical_alerts();

COMMENT ON INDEX idx_medical_alerts_unique_pending IS 'Prevents duplicate pending alerts for the same pet, condition, and due date';
