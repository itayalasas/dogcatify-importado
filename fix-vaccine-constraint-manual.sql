-- SQL para ejecutar directamente en Supabase Dashboard
-- Ir a: Dashboard > SQL Editor > New query

-- 1. Eliminar el índice único anterior
DROP INDEX IF EXISTS idx_unique_vaccine_reminder;

-- 2. Crear nuevo índice único con las columnas correctas
CREATE UNIQUE INDEX idx_unique_vaccine_reminder 
  ON scheduled_notifications(reference_id, notification_type, status)
  WHERE notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours');

-- 3. Actualizar la función para que maneje duplicados correctamente
CREATE OR REPLACE FUNCTION create_vaccine_reminder_notifications()
RETURNS TRIGGER AS $$
DECLARE
  reminder_7days_time timestamptz;
  reminder_24hours_time timestamptz;
  pet_name_text text;
  vaccine_name_text text;
  next_due_date_parsed date;
BEGIN
  -- Solo procesar si es una vacuna
  IF NEW.type = 'vaccine' AND NEW.next_due_date IS NOT NULL AND NEW.next_due_date != '' THEN
    
    -- Parsear fecha de próxima dosis (formato DD/MM/YYYY)
    BEGIN
      next_due_date_parsed := to_date(NEW.next_due_date, 'DD/MM/YYYY');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        next_due_date_parsed := to_date(NEW.next_due_date, 'YYYY-MM-DD');
      EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
      END;
    END;
    
    -- Calcular tiempos de recordatorio
    reminder_7days_time := next_due_date_parsed::timestamptz - interval '7 days';
    reminder_24hours_time := next_due_date_parsed::timestamptz - interval '24 hours';
    
    -- Obtener nombre de mascota
    SELECT p.name INTO pet_name_text FROM pets p WHERE p.id = NEW.pet_id;
    
    -- Usar nombre de vacuna
    vaccine_name_text := COALESCE(NEW.name, 'vacuna');
    
    -- Cancelar notificaciones pendientes existentes
    UPDATE scheduled_notifications
    SET status = 'cancelled', updated_at = now()
    WHERE reference_id = NEW.id 
      AND reference_type = 'pet_health'
      AND notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
      AND status = 'pending';
    
    -- NOTIFICACIÓN 1: 7 días antes
    IF reminder_7days_time > now() THEN
      INSERT INTO scheduled_notifications (
        user_id, notification_type, reference_id, reference_type,
        title, body, data, scheduled_for, status
      ) VALUES (
        NEW.user_id, 'vaccine_reminder_7days', NEW.id, 'pet_health',
        '🐾 Recordatorio de Vacuna',
        format('En 7 días vence el refuerzo de %s para %s', vaccine_name_text, pet_name_text),
        jsonb_build_object(
          'vaccine_id', NEW.id, 'pet_id', NEW.pet_id,
          'pet_name', pet_name_text, 'vaccine_name', vaccine_name_text,
          'next_due_date', NEW.next_due_date, 'screen', 'PetDetails', 'tab', 'health'
        ),
        reminder_7days_time, 'pending'
      )
      ON CONFLICT (reference_id, notification_type, status) 
      WHERE notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
      DO UPDATE SET
        scheduled_for = EXCLUDED.scheduled_for,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        updated_at = now();
    END IF;
    
    -- NOTIFICACIÓN 2: 24 horas antes
    IF reminder_24hours_time > now() THEN
      INSERT INTO scheduled_notifications (
        user_id, notification_type, reference_id, reference_type,
        title, body, data, scheduled_for, status
      ) VALUES (
        NEW.user_id, 'vaccine_reminder_24hours', NEW.id, 'pet_health',
        '⚠️ ¡Vacuna Mañana!',
        format('Mañana vence el refuerzo de %s para %s', vaccine_name_text, pet_name_text),
        jsonb_build_object(
          'vaccine_id', NEW.id, 'pet_id', NEW.pet_id,
          'pet_name', pet_name_text, 'vaccine_name', vaccine_name_text,
          'next_due_date', NEW.next_due_date, 'screen', 'PetDetails', 'tab', 'health'
        ),
        reminder_24hours_time, 'pending'
      )
      ON CONFLICT (reference_id, notification_type, status) 
      WHERE notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
      DO UPDATE SET
        scheduled_for = EXCLUDED.scheduled_for,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        data = EXCLUDED.data,
        updated_at = now();
    END IF;
  END IF;
  
  -- Si se actualiza o elimina, cancelar notificaciones pendientes
  IF TG_OP = 'UPDATE' AND OLD.type = 'vaccine' THEN
    IF (OLD.next_due_date IS DISTINCT FROM NEW.next_due_date) OR NEW.next_due_date IS NULL OR NEW.next_due_date = '' THEN
      UPDATE scheduled_notifications
      SET status = 'cancelled', updated_at = now()
      WHERE reference_id = OLD.id 
        AND reference_type = 'pet_health'
        AND notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
        AND status = 'pending';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' AND OLD.type = 'vaccine' THEN
    UPDATE scheduled_notifications
    SET status = 'cancelled', updated_at = now()
    WHERE reference_id = OLD.id 
      AND reference_type = 'pet_health'
      AND notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours')
      AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
