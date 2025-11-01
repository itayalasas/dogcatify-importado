/*
  # Sistema de Notificaciones Programadas
  
  ## Descripción
  Sistema completo para enviar notificaciones push automáticas a usuarios:
  - Recordatorios 24 horas antes de reservas de servicios
  - Notificaciones cuando cambia el estado de órdenes de compra
  
  ## Nuevas Tablas
  
  ### `scheduled_notifications`
  Almacena todas las notificaciones programadas o enviadas del sistema
  - `id` (uuid, PK) - Identificador único
  - `user_id` (uuid, FK) - Usuario que recibirá la notificación
  - `notification_type` (text) - Tipo: 'booking_reminder', 'order_status_change'
  - `reference_id` (uuid) - ID de la reserva u orden relacionada
  - `reference_type` (text) - 'booking' o 'order'
  - `title` (text) - Título de la notificación
  - `body` (text) - Cuerpo del mensaje
  - `data` (jsonb) - Datos adicionales para deep linking
  - `scheduled_for` (timestamptz) - Fecha/hora programada para envío
  - `sent_at` (timestamptz) - Fecha/hora de envío real (null si no enviada)
  - `status` (text) - 'pending', 'sent', 'failed', 'cancelled'
  - `error_message` (text) - Mensaje de error si falló
  - `retry_count` (integer) - Número de reintentos
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de última actualización
  
  ## Funciones y Triggers
  
  ### 1. `create_booking_reminder_notification()`
  Crea notificación recordatorio 24h antes de una reserva confirmada
  
  ### 2. `create_order_status_notification()`
  Crea notificación cuando cambia el estado de una orden
  
  ### 3. Trigger `on_booking_confirmed`
  Se ejecuta cuando una reserva es confirmada (payment_status = 'approved')
  
  ### 4. Trigger `on_order_status_change`
  Se ejecuta cuando cambia el status de una orden
  
  ## Seguridad (RLS)
  - Los usuarios solo pueden ver sus propias notificaciones
  - Solo el sistema puede crear/actualizar notificaciones
  
  ## Notas Importantes
  - Las notificaciones de recordatorio se crean 24 horas antes del evento
  - Las notificaciones de cambio de estado se crean inmediatamente
  - Se previenen duplicados con constraints únicos
  - Estado 'cancelled' permite cancelar notificaciones si se cancela la reserva
*/

-- Crear tabla de notificaciones programadas
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('booking_reminder', 'order_status_change')),
  reference_id uuid NOT NULL,
  reference_type text NOT NULL CHECK (reference_type IN ('booking', 'order')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_for ON scheduled_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_reference ON scheduled_notifications(reference_id, reference_type);

-- Índice compuesto para búsquedas de notificaciones pendientes
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending 
  ON scheduled_notifications(status, scheduled_for) 
  WHERE status = 'pending';

-- Constraint único para prevenir duplicados de recordatorios
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_booking_reminder 
  ON scheduled_notifications(reference_id, notification_type) 
  WHERE notification_type = 'booking_reminder' AND status IN ('pending', 'sent');

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_scheduled_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_scheduled_notifications_updated_at_trigger ON scheduled_notifications;
CREATE TRIGGER update_scheduled_notifications_updated_at_trigger
  BEFORE UPDATE ON scheduled_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_notifications_updated_at();

-- Función para crear notificación de recordatorio de reserva (24h antes)
CREATE OR REPLACE FUNCTION create_booking_reminder_notification()
RETURNS TRIGGER AS $$
DECLARE
  reminder_time timestamptz;
  pet_name_text text;
  service_name_text text;
BEGIN
  -- Solo crear notificación si el pago fue aprobado
  IF NEW.payment_status = 'approved' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'approved') THEN
    
    -- Calcular hora de recordatorio (24 horas antes)
    reminder_time := NEW.date - interval '24 hours';
    
    -- Solo crear si la reserva es en más de 24 horas
    IF reminder_time > now() THEN
      
      -- Obtener nombres para el mensaje
      pet_name_text := COALESCE(NEW.pet_name, 'tu mascota');
      service_name_text := COALESCE(NEW.service_name, 'servicio');
      
      -- Insertar notificación programada (con ON CONFLICT para evitar duplicados)
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
        NEW.customer_id,
        'booking_reminder',
        NEW.id,
        'booking',
        '¡Recordatorio de Reserva!',
        format('Mañana tienes una cita de %s para %s a las %s', 
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
      )
      ON CONFLICT ON CONSTRAINT idx_unique_booking_reminder DO NOTHING;
    END IF;
  END IF;
  
  -- Si se cancela la reserva, cancelar la notificación
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

-- Trigger para crear notificación de recordatorio cuando se confirma pago de booking
DROP TRIGGER IF EXISTS on_booking_confirmed ON bookings;
CREATE TRIGGER on_booking_confirmed
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION create_booking_reminder_notification();

-- Función para crear notificación de cambio de estado de orden
CREATE OR REPLACE FUNCTION create_order_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_body text;
  order_type_text text;
BEGIN
  -- Solo notificar si el estado cambió
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    
    order_type_text := CASE 
      WHEN NEW.order_type = 'service' THEN 'reserva'
      ELSE 'pedido'
    END;
    
    -- Determinar título y cuerpo según el nuevo estado
    CASE NEW.status
      WHEN 'confirmed' THEN
        notification_title := '¡Pedido Confirmado!';
        notification_body := format('Tu %s ha sido confirmado y está siendo procesado', order_type_text);
      
      WHEN 'preparing' THEN
        notification_title := 'Preparando tu Pedido';
        notification_body := format('Estamos preparando tu %s', order_type_text);
      
      WHEN 'ready' THEN
        notification_title := '¡Pedido Listo!';
        notification_body := format('Tu %s está listo para ser enviado', order_type_text);
      
      WHEN 'shipped' THEN
        notification_title := 'Pedido Enviado';
        notification_body := format('Tu %s está en camino', order_type_text);
      
      WHEN 'delivered' THEN
        notification_title := '¡Pedido Entregado!';
        notification_body := format('Tu %s ha sido entregado. ¡Esperamos que lo disfrutes!', order_type_text);
      
      WHEN 'completed' THEN
        notification_title := 'Pedido Completado';
        notification_body := format('Tu %s ha sido completado. ¡Gracias por tu compra!', order_type_text);
      
      WHEN 'cancelled' THEN
        notification_title := 'Pedido Cancelado';
        notification_body := format('Tu %s ha sido cancelado', order_type_text);
      
      ELSE
        -- No notificar para otros estados
        RETURN NEW;
    END CASE;
    
    -- Insertar notificación para envío inmediato
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
      NEW.customer_id,
      'order_status_change',
      NEW.id,
      'order',
      notification_title,
      notification_body,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_type', NEW.order_type,
        'status', NEW.status,
        'total_amount', NEW.total_amount,
        'screen', 'OrderDetails'
      ),
      now(), -- Enviar inmediatamente
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear notificación cuando cambia estado de orden
DROP TRIGGER IF EXISTS on_order_status_change ON orders;
CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_order_status_notification();

-- Habilitar RLS
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Los usuarios solo pueden ver sus propias notificaciones
CREATE POLICY "Users can view own notifications"
  ON scheduled_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Solo el sistema (service_role) puede insertar/actualizar notificaciones
-- Las edge functions usarán service_role para gestionar notificaciones
