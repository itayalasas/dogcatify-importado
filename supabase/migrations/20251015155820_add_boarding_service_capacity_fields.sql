/*
  # Agregar campos de capacidad y tipo de mascota para servicios de Pensión
  
  1. Cambios en la tabla `partner_services`
    - Agregar columnas para capacidad por categoría de hospedaje
    - Agregar campo para tipo de mascota (perro/gato)
    - Agregar arreglo de imágenes para servicios
    
  2. Nueva estructura para servicios de Pensión (boarding)
    - `capacity_daily` - Capacidad para hospedaje diario
    - `capacity_overnight` - Capacidad para hospedaje nocturno
    - `capacity_weekend` - Capacidad para fin de semana
    - `capacity_weekly` - Capacidad para hospedaje semanal
    - `pet_type` - Tipo de mascota: 'dog', 'cat', 'both'
    - `images` - Array de URLs de imágenes del servicio
    - `price_daily` - Precio para hospedaje diario (reemplaza price)
    - `price_overnight` - Precio para hospedaje nocturno
    - `price_weekend` - Precio para fin de semana
    - `price_weekly` - Precio para hospedaje semanal
    
  3. Notas importantes
    - Los campos de capacidad y precios específicos solo aplican para business_type = 'boarding'
    - Para otros tipos de servicio, se mantiene el campo `price` y `duration` existentes
    - El campo `category` indica el tipo de hospedaje: 'Diario', 'Nocturno', 'Fin de semana', 'Semanal'
*/

-- Agregar columnas de capacidad para servicios de Pensión
DO $$
BEGIN
  -- Capacidad diaria
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'capacity_daily'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN capacity_daily integer DEFAULT NULL;
  END IF;
  
  -- Capacidad nocturna
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'capacity_overnight'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN capacity_overnight integer DEFAULT NULL;
  END IF;
  
  -- Capacidad fin de semana
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'capacity_weekend'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN capacity_weekend integer DEFAULT NULL;
  END IF;
  
  -- Capacidad semanal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'capacity_weekly'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN capacity_weekly integer DEFAULT NULL;
  END IF;
  
  -- Tipo de mascota aceptada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'pet_type'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN pet_type text DEFAULT 'both' CHECK (pet_type IN ('dog', 'cat', 'both'));
  END IF;
  
  -- Precio diario
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'price_daily'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN price_daily numeric DEFAULT NULL;
  END IF;
  
  -- Precio nocturno
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'price_overnight'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN price_overnight numeric DEFAULT NULL;
  END IF;
  
  -- Precio fin de semana
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'price_weekend'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN price_weekend numeric DEFAULT NULL;
  END IF;
  
  -- Precio semanal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'price_weekly'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN price_weekly numeric DEFAULT NULL;
  END IF;
  
  -- Array de imágenes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'images'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN images text[] DEFAULT '{}';
  END IF;
END $$;

-- Agregar columna para rastrear reservas activas por categoría en bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'boarding_category'
  ) THEN
    ALTER TABLE bookings ADD COLUMN boarding_category text DEFAULT NULL;
  END IF;
  
  -- Fecha de fin para reservas de pensión
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE bookings ADD COLUMN end_date date DEFAULT NULL;
  END IF;
END $$;

-- Crear índices para mejorar rendimiento en consultas de disponibilidad
CREATE INDEX IF NOT EXISTS idx_bookings_service_category 
  ON bookings(service_id, boarding_category) 
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_bookings_date_range 
  ON bookings(date, end_date) 
  WHERE status = 'confirmed';

-- Crear función para verificar disponibilidad de capacidad por categoría
CREATE OR REPLACE FUNCTION check_boarding_capacity(
  p_service_id uuid,
  p_category text,
  p_date date,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity integer;
  v_current_bookings integer;
  v_available integer;
  v_service record;
BEGIN
  -- Obtener el servicio y su capacidad
  SELECT 
    capacity_daily,
    capacity_overnight,
    capacity_weekend,
    capacity_weekly
  INTO v_service
  FROM partner_services
  WHERE id = p_service_id;
  
  -- Determinar la capacidad según la categoría
  CASE p_category
    WHEN 'Diario' THEN
      v_capacity := v_service.capacity_daily;
    WHEN 'Nocturno' THEN
      v_capacity := v_service.capacity_overnight;
    WHEN 'Fin de semana' THEN
      v_capacity := v_service.capacity_weekend;
    WHEN 'Semanal' THEN
      v_capacity := v_service.capacity_weekly;
    ELSE
      v_capacity := 0;
  END CASE;
  
  -- Si no hay end_date, usar solo la fecha de inicio
  IF p_end_date IS NULL THEN
    p_end_date := p_date;
  END IF;
  
  -- Contar reservas activas en el rango de fechas
  SELECT COUNT(*)
  INTO v_current_bookings
  FROM bookings
  WHERE service_id = p_service_id
    AND boarding_category = p_category
    AND status = 'confirmed'
    AND (
      -- La reserva existente se solapa con el rango solicitado
      (date <= p_end_date AND COALESCE(end_date, date) >= p_date)
    );
  
  -- Calcular disponibilidad
  v_available := GREATEST(0, COALESCE(v_capacity, 0) - v_current_bookings);
  
  RETURN jsonb_build_object(
    'capacity', v_capacity,
    'booked', v_current_bookings,
    'available', v_available,
    'has_availability', v_available > 0
  );
END;
$$;

-- Comentarios en las columnas para documentación
COMMENT ON COLUMN partner_services.capacity_daily IS 'Capacidad máxima de mascotas para hospedaje diario';
COMMENT ON COLUMN partner_services.capacity_overnight IS 'Capacidad máxima de mascotas para hospedaje nocturno';
COMMENT ON COLUMN partner_services.capacity_weekend IS 'Capacidad máxima de mascotas para hospedaje de fin de semana';
COMMENT ON COLUMN partner_services.capacity_weekly IS 'Capacidad máxima de mascotas para hospedaje semanal';
COMMENT ON COLUMN partner_services.pet_type IS 'Tipo de mascota aceptada: dog (perros), cat (gatos), both (ambos)';
COMMENT ON COLUMN partner_services.price_daily IS 'Precio por día de hospedaje diario';
COMMENT ON COLUMN partner_services.price_overnight IS 'Precio por noche de hospedaje nocturno';
COMMENT ON COLUMN partner_services.price_weekend IS 'Precio por fin de semana';
COMMENT ON COLUMN partner_services.price_weekly IS 'Precio por semana';
COMMENT ON COLUMN partner_services.images IS 'Array de URLs de imágenes del servicio';
COMMENT ON COLUMN bookings.boarding_category IS 'Categoría de hospedaje: Diario, Nocturno, Fin de semana, Semanal';
COMMENT ON COLUMN bookings.end_date IS 'Fecha de finalización para reservas de pensión de múltiples días';
