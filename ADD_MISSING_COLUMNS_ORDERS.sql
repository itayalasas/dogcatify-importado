-- ============================================
-- Script para agregar columnas faltantes a la tabla orders
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================

-- 1. Agregar columna partner_name (nombre del negocio)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS partner_name text;

-- 2. Agregar columna service_name (nombre del servicio para service_booking)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS service_name text;

-- 3. Agregar columna pet_name (nombre de la mascota)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS pet_name text;

-- 4. Agregar columna customer_name (nombre del cliente)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_name text;

-- 5. Agregar columna customer_email (email del cliente)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_email text;

-- 6. Agregar columna customer_phone (teléfono del cliente)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_phone text;

-- 7. Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_orders_partner_name ON orders(partner_name);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 8. Agregar comentarios a las columnas para documentación
COMMENT ON COLUMN orders.partner_name IS 'Nombre del negocio/partner (veterinaria, peluquería, etc.)';
COMMENT ON COLUMN orders.service_name IS 'Nombre del servicio reservado (solo para order_type = service_booking)';
COMMENT ON COLUMN orders.pet_name IS 'Nombre de la mascota asociada a la orden';
COMMENT ON COLUMN orders.customer_name IS 'Nombre completo del cliente';
COMMENT ON COLUMN orders.customer_email IS 'Email del cliente';
COMMENT ON COLUMN orders.customer_phone IS 'Teléfono del cliente';

-- ============================================
-- Verificar que las columnas se agregaron correctamente
-- ============================================
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
    AND column_name IN (
        'partner_name',
        'service_name',
        'pet_name',
        'customer_name',
        'customer_email',
        'customer_phone'
    )
ORDER BY column_name;
