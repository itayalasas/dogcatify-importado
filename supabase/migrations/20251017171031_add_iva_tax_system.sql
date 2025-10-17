/*
  # Sistema de IVA para Órdenes, Servicios y Productos

  ## Descripción
  Implementa un sistema completo de IVA (Impuesto al Valor Agregado) que permite a los partners configurar:
  - Porcentaje de IVA aplicable
  - Si el IVA está incluido en el precio o se suma al final
  - Almacenamiento del IVA en las órdenes para facturación

  ## Cambios en Tablas

  ### 1. partners
  - `iva_rate` (decimal): Porcentaje de IVA (ej: 21.00 para 21%)
  - `iva_included_in_price` (boolean): Si el IVA está incluido en el precio mostrado

  ### 2. partner_services
  - `iva_rate` (decimal): Porcentaje de IVA específico del servicio (hereda de partner si es null)
  - `iva_included_in_price` (boolean): Si el IVA está incluido en el precio (hereda de partner si es null)

  ### 3. partner_products
  - `iva_rate` (decimal): Porcentaje de IVA específico del producto
  - `iva_included_in_price` (boolean): Si el IVA está incluido en el precio

  ### 4. orders
  - `subtotal` (decimal): Total sin IVA
  - `iva_rate` (decimal): Porcentaje de IVA aplicado
  - `iva_amount` (decimal): Monto del IVA
  - `iva_included_in_price` (boolean): Si el IVA estaba incluido en los precios originales
  - `total_amount` se mantiene como el total final

  ## Notas Importantes
  - Por defecto, iva_rate es 0 (sin IVA)
  - Los servicios y productos heredan la configuración del partner si no tienen configuración propia
  - El cálculo se realiza al crear la orden
*/

-- 1. Agregar campos de IVA a partners
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS iva_rate DECIMAL(5,2) DEFAULT 0 CHECK (iva_rate >= 0 AND iva_rate <= 100),
ADD COLUMN IF NOT EXISTS iva_included_in_price BOOLEAN DEFAULT false;

COMMENT ON COLUMN partners.iva_rate IS 'Porcentaje de IVA (ej: 21.00 para 21%)';
COMMENT ON COLUMN partners.iva_included_in_price IS 'Si true, el precio mostrado incluye IVA. Si false, el IVA se suma al precio.';

-- 2. Agregar campos de IVA a partner_services
ALTER TABLE partner_services 
ADD COLUMN IF NOT EXISTS iva_rate DECIMAL(5,2) CHECK (iva_rate >= 0 AND iva_rate <= 100),
ADD COLUMN IF NOT EXISTS iva_included_in_price BOOLEAN;

COMMENT ON COLUMN partner_services.iva_rate IS 'Porcentaje de IVA específico del servicio. Si NULL, hereda de partners.';
COMMENT ON COLUMN partner_services.iva_included_in_price IS 'Si el IVA está incluido. Si NULL, hereda de partners.';

-- 3. Agregar campos de IVA a partner_products
ALTER TABLE partner_products 
ADD COLUMN IF NOT EXISTS iva_rate DECIMAL(5,2) CHECK (iva_rate >= 0 AND iva_rate <= 100),
ADD COLUMN IF NOT EXISTS iva_included_in_price BOOLEAN;

COMMENT ON COLUMN partner_products.iva_rate IS 'Porcentaje de IVA del producto. Si NULL, hereda de partners.';
COMMENT ON COLUMN partner_products.iva_included_in_price IS 'Si el IVA está incluido. Si NULL, hereda de partners.';

-- 4. Agregar campos de IVA a orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_included_in_price BOOLEAN DEFAULT false;

COMMENT ON COLUMN orders.subtotal IS 'Total sin IVA (base imponible)';
COMMENT ON COLUMN orders.iva_rate IS 'Porcentaje de IVA aplicado a esta orden';
COMMENT ON COLUMN orders.iva_amount IS 'Monto del IVA en esta orden';
COMMENT ON COLUMN orders.iva_included_in_price IS 'Si el IVA estaba incluido en los precios originales';
COMMENT ON COLUMN orders.total_amount IS 'Total final: Si IVA incluido = subtotal. Si IVA no incluido = subtotal + iva_amount';

-- Crear índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_partners_iva ON partners(iva_rate) WHERE iva_rate > 0;
CREATE INDEX IF NOT EXISTS idx_orders_iva ON orders(iva_rate) WHERE iva_rate > 0;