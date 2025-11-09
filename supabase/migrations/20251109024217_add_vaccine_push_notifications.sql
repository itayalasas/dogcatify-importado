/*
  # Sistema de Recordatorios Push para Vacunas

  ## Descripción
  Agrega notificaciones push programadas automáticas para recordatorios de vacunas:
  - 7 días antes de la próxima dosis
  - 24 horas antes de la próxima dosis

  ## Cambios

  ### 1. Actualizar tipos de notificación
  - Agregar 'vaccine_reminder_7days' y 'vaccine_reminder_24hours'
  - Mantener todos los tipos existentes

  ### 2. Nueva función `create_vaccine_reminder_notifications()`
  - Crea 2 notificaciones programadas cuando se registra una vacuna con próxima dosis
  - Una para 7 días antes
  - Otra para 24 horas antes

  ### 3. Triggers para la tabla pet_health (type = 'vaccine')
  - Se ejecutan cuando se crea, actualiza o elimina un registro de vacuna
*/

-- 1. Eliminar constraints existentes
ALTER TABLE scheduled_notifications 
DROP CONSTRAINT IF EXISTS scheduled_notifications_notification_type_check;

ALTER TABLE scheduled_notifications 
DROP CONSTRAINT IF EXISTS scheduled_notifications_reference_type_check;

-- 2. Recrear constraint para notification_type con TODOS los tipos
ALTER TABLE scheduled_notifications 
ADD CONSTRAINT scheduled_notifications_notification_type_check 
CHECK (notification_type IN (
  'booking_reminder', 
  'order_status_change', 
  'pet_share_request',
  'pet_share_accepted',
  'pet_share_invitation',
  'booking_confirmation',
  'vaccine_reminder_7days', 
  'vaccine_reminder_24hours'
));

-- 3. Recrear constraint para reference_type
ALTER TABLE scheduled_notifications 
ADD CONSTRAINT scheduled_notifications_reference_type_check 
CHECK (reference_type IN ('booking', 'order', 'pet_share', 'pet_health'));

-- 4. Índice único para prevenir duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_vaccine_reminder 
  ON scheduled_notifications(reference_id, notification_type) 
  WHERE notification_type IN ('vaccine_reminder_7days', 'vaccine_reminder_24hours') 
    AND status IN ('pending', 'sent');

-- 5. Función para crear notificaciones de recordatorio de vacunas
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
      -- Si no se puede parsear, intentar otros formatos
      BEGIN
        next_due_date_parsed := to_date(NEW.next_due_date, 'YYYY-MM-DD');
      EXCEPTION WHEN OTHERS THEN
        -- Si no se puede parsear, salir
        RETURN NEW;
      END;
    END;
    
    -- Calcular tiempos de recordatorio
    reminder_7days_time := next_due_date_parsed::timestamptz - interval '7 days';
    reminder_24hours_time := next_due_date_parsed::timestamptz - interval '24 hours';
    
    -- Obtener nombre de mascota
    SELECT p.name INTO pet_name_text
    FROM pets p
    WHERE p.id = NEW.pet_id;
    
    -- Usar nombre de vacuna
    vaccine_name_text := COALESCE(NEW.name, 'vacuna');
    
    -- NOTIFICACIÓN 1: 7 días antes
    IF reminder_7days_time > now() THEN
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
      ) VALUES (
        NEW.user_id,
        'vaccine_reminder_7days',
        NEW.id,
        'pet_health',
        '🐾 Recordatorio de Vacuna',
        format('En 7 días vence el refuerzo de %s para %s', 
          vaccine_name_text, 
          pet_name_text
        ),
        jsonb_build_object(
          'vaccine_id', NEW.id,
          'pet_id', NEW.pet_id,
          'pet_name', pet_name_text,
          'vaccine_name', vaccine_name_text,
          'next_due_date', NEW.next_due_date,
          'screen', 'PetDetails',
          'tab', 'health'
        ),
        reminder_7days_time,
        'pending'
      )
      ON CONFLICT ON CONSTRAINT idx_unique_vaccine_reminder DO NOTHING;
    END IF;
    
    -- NOTIFICACIÓN 2: 24 horas antes
    IF reminder_24hours_time > now() THEN
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
      ) VALUES (
        NEW.user_id,
        'vaccine_reminder_24hours',
        NEW.id,
        'pet_health',
        '⚠️ ¡Vacuna Mañana!',
        format('Mañana vence el refuerzo de %s para %s', 
          vaccine_name_text, 
          pet_name_text
        ),
        jsonb_build_object(
          'vaccine_id', NEW.id,
          'pet_id', NEW.pet_id,
          'pet_name', pet_name_text,
          'vaccine_name', vaccine_name_text,
          'next_due_date', NEW.next_due_date,
          'screen', 'PetDetails',
          'tab', 'health'
        ),
        reminder_24hours_time,
        'pending'
      )
      ON CONFLICT ON CONSTRAINT idx_unique_vaccine_reminder DO NOTHING;
    END IF;
  END IF;
  
  -- Si se actualiza la fecha o se elimina, cancelar notificaciones pendientes
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

-- 6. Trigger para crear notificaciones cuando se crea o actualiza vacuna
DROP TRIGGER IF EXISTS on_vaccine_created_or_updated ON pet_health;
CREATE TRIGGER on_vaccine_created_or_updated
  AFTER INSERT OR UPDATE ON pet_health
  FOR EACH ROW
  EXECUTE FUNCTION create_vaccine_reminder_notifications();

-- 7. Trigger para cancelar notificaciones cuando se elimina vacuna
DROP TRIGGER IF EXISTS on_vaccine_deleted ON pet_health;
CREATE TRIGGER on_vaccine_deleted
  AFTER DELETE ON pet_health
  FOR EACH ROW
  EXECUTE FUNCTION create_vaccine_reminder_notifications();
