/*
  # Agregar columna updated_at a partner_products

  1. Cambios
    - Agregar columna `updated_at` a la tabla `partner_products`
    - Crear trigger para actualizar automáticamente `updated_at`
    - Actualizar triggers de stock para que funcionen correctamente

  2. Nueva Columna
    - `updated_at`: timestamp with time zone, se actualiza automáticamente

  3. Triggers
    - `update_partner_products_updated_at`: Actualiza updated_at en cada UPDATE
*/

-- Agregar columna updated_at si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'partner_products' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE partner_products 
    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    RAISE NOTICE '✅ Columna updated_at agregada a partner_products';
  ELSE
    RAISE NOTICE 'ℹ️  Columna updated_at ya existe';
  END IF;
END $$;

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS update_partner_products_updated_at ON partner_products;

-- Crear trigger para actualizar updated_at automáticamente en cada UPDATE
CREATE TRIGGER update_partner_products_updated_at
  BEFORE UPDATE ON partner_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Actualizar updated_at de todos los productos existentes
UPDATE partner_products 
SET updated_at = created_at 
WHERE updated_at IS NULL;

COMMENT ON COLUMN partner_products.updated_at IS 
  'Timestamp de última actualización del producto, se actualiza automáticamente';

COMMENT ON TRIGGER update_partner_products_updated_at ON partner_products IS 
  'Actualiza automáticamente updated_at en cada modificación del producto';
