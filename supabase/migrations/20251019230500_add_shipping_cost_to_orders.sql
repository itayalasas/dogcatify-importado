/*
  # Agregar campo de costo de envío a la tabla orders

  1. Nueva Columna
    - `shipping_cost` (numeric) - Costo del envío para órdenes de productos
      - DEFAULT 0
      - Para órdenes de tipo 'product_purchase' que requieren envío
      - Para órdenes de tipo 'service_booking' siempre será 0 (sin envío)
      - El IVA se aplica también al costo de envío según la configuración

  2. Razón
    - Permitir registrar el costo de envío por separado del subtotal de productos
    - Facilitar el cálculo correcto del IVA sobre el envío
    - Proporcionar transparencia en la facturación
    - Enviar información completa al CRM mediante webhooks

  3. Notas Importantes
    - El costo de envío se suma al subtotal antes de calcular el IVA
    - Para servicios, este campo siempre debe ser 0 o NULL
    - El webhook debe incluir este campo en el JSON para todos los tipos de órdenes
*/

-- Agregar columna shipping_cost
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_cost'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_cost numeric DEFAULT 0;
  END IF;
END $$;

-- Crear índice para consultas que filtren por órdenes con envío
CREATE INDEX IF NOT EXISTS idx_orders_shipping_cost ON orders(shipping_cost) WHERE shipping_cost > 0;

-- Agregar comentario a la columna
COMMENT ON COLUMN orders.shipping_cost IS 'Costo de envío para órdenes de productos. 0 para servicios sin envío.';
