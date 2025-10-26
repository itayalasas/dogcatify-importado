/*
  # Sistema de Reintento de Pagos

  1. Cambios en Orders
    - Agregar campo `payment_link_expires_at` para tracking de expiración
    - Agregar campo `payment_retry_count` para contar reintentos
    - Agregar campo `last_payment_url` para almacenar último link generado
    - Actualizar constraint de status para incluir 'payment_failed'
  
  2. Notas Importantes
    - Las preferencias de Mercado Pago expiran después de 24 horas
    - Un pedido puede estar en 'pending' (esperando pago) o 'payment_failed' (pago rechazado/error)
    - Los usuarios podrán reintentar el pago si el link sigue vigente
    - Si el link expiró, se generará una nueva preferencia
  
  3. Estados de Orden
    - pending: Pedido creado, esperando pago
    - payment_failed: Pago rechazado o error en procesamiento
    - confirmed: Pago aprobado
    - processing: En preparación
    - shipped: Enviado
    - delivered: Entregado
    - cancelled: Cancelado
    - insufficient_stock: Sin stock suficiente
*/

-- Agregar nuevos campos para sistema de reintentos
DO $$ 
BEGIN
  -- Campo para tracking de expiración del link de pago
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_link_expires_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_link_expires_at timestamptz;
  END IF;

  -- Campo para contar reintentos de pago
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_retry_count'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_retry_count integer DEFAULT 0;
  END IF;

  -- Campo para almacenar URL del último intento de pago
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'last_payment_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN last_payment_url text;
  END IF;
END $$;

-- Actualizar constraint de status para incluir todos los estados existentes + payment_failed
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'pending',
    'payment_failed', 
    'confirmed', 
    'processing', 
    'shipped', 
    'delivered', 
    'cancelled',
    'insufficient_stock'
  ));

-- Crear índice para búsquedas de pedidos con pago pendiente/fallido
CREATE INDEX IF NOT EXISTS idx_orders_payment_status 
  ON orders(customer_id, status) 
  WHERE status IN ('pending', 'payment_failed');

-- Función para verificar si un link de pago está expirado
CREATE OR REPLACE FUNCTION is_payment_link_expired(order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expires_at timestamptz;
BEGIN
  SELECT payment_link_expires_at INTO expires_at
  FROM orders
  WHERE id = order_id;
  
  -- Si no hay fecha de expiración, considerar expirado (para órdenes antiguas)
  IF expires_at IS NULL THEN
    RETURN true;
  END IF;
  
  -- Verificar si ya expiró
  RETURN expires_at < now();
END;
$$;

-- Función para marcar un pago como fallido
CREATE OR REPLACE FUNCTION mark_payment_as_failed(order_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE orders
  SET 
    status = 'payment_failed',
    updated_at = now()
  WHERE id = order_id
    AND status IN ('pending', 'payment_failed');
END;
$$;

-- Actualizar órdenes pendientes antiguas con fecha de expiración (24 horas desde creación)
UPDATE orders
SET payment_link_expires_at = created_at + interval '24 hours'
WHERE payment_link_expires_at IS NULL
  AND status IN ('pending', 'payment_failed')
  AND created_at IS NOT NULL;

-- Comentarios en las columnas
COMMENT ON COLUMN orders.payment_link_expires_at IS 'Fecha y hora en que expira el link de pago de Mercado Pago (típicamente 24h)';
COMMENT ON COLUMN orders.payment_retry_count IS 'Número de veces que el usuario ha reintentado el pago';
COMMENT ON COLUMN orders.last_payment_url IS 'URL del último intento de pago generado';
