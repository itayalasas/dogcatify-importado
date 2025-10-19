/*
  # Agregar columnas de detalles a la tabla orders

  1. Nuevas Columnas
    - `partner_name` (text) - Nombre del partner/negocio
    - `service_name` (text) - Nombre del servicio (para órdenes de tipo service_booking)
    - `pet_name` (text) - Nombre de la mascota
    - `customer_name` (text) - Nombre del cliente
    - `customer_email` (text) - Email del cliente
    - `customer_phone` (text) - Teléfono del cliente
    - `subtotal` (numeric) - Subtotal antes de IVA
    - `iva_rate` (numeric) - Tasa de IVA aplicada
    - `iva_amount` (numeric) - Monto de IVA
    - `iva_included_in_price` (boolean) - Si el IVA está incluido en el precio

  2. Razón
    - Facilitar la gestión de órdenes sin necesidad de hacer JOINs
    - Mantener datos históricos incluso si se eliminan registros relacionados
    - Mejorar la generación de reportes y facturas
*/

-- Agregar columnas de información del partner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'partner_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN partner_name text;
  END IF;
END $$;

-- Agregar columnas de información del servicio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'service_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN service_name text;
  END IF;
END $$;

-- Agregar columnas de información de la mascota
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pet_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN pet_name text;
  END IF;
END $$;

-- Agregar columnas de información del cliente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_email text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN customer_phone text;
  END IF;
END $$;

-- Agregar columnas de IVA
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE orders ADD COLUMN subtotal numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'iva_rate'
  ) THEN
    ALTER TABLE orders ADD COLUMN iva_rate numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'iva_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN iva_amount numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'iva_included_in_price'
  ) THEN
    ALTER TABLE orders ADD COLUMN iva_included_in_price boolean DEFAULT false;
  END IF;
END $$;

-- Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_orders_partner_name ON orders(partner_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
