/*
  # Sistema de Gestión de Stock - Corrección con Tabla Correcta

  1. Cambios Principales
    - Descontar stock INMEDIATAMENTE al crear la orden (INSERT)
    - Restaurar stock cuando se cancela una orden
    - Desactivar productos automáticamente cuando stock = 0
    - Reactivar productos cuando vuelve a haber stock

  2. Tabla Correcta: partner_products (no products)

  3. Nuevas Funciones
    - `decrease_stock_on_order_insert()`: Descuenta stock al crear orden
    - `restore_stock_on_order_cancel()`: Restaura stock al cancelar
    - `check_and_disable_product()`: Desactiva productos sin stock

  4. Triggers
    - `trigger_decrease_stock_on_insert`: Se ejecuta al crear una orden
    - `trigger_restore_stock_on_cancel`: Se ejecuta al cancelar una orden
    - `trigger_check_stock_after_update`: Verifica y desactiva si stock = 0

  5. Flujo de Stock
    - Usuario crea orden → Stock se descuenta INMEDIATAMENTE
    - Si stock llega a 0 → Producto se marca como is_active = false
    - Usuario cancela → Stock se restaura
    - Si stock > 0 nuevamente → Producto se reactiva
*/

-- ELIMINAR TRIGGERS Y FUNCIONES ANTERIORES
DROP TRIGGER IF EXISTS trigger_decrease_stock_on_order_payment ON orders;
DROP TRIGGER IF EXISTS trigger_restore_stock_on_order_cancel ON orders;
DROP TRIGGER IF EXISTS trigger_decrease_stock_on_insert ON orders;
DROP TRIGGER IF EXISTS trigger_restore_stock_on_cancel ON orders;
DROP TRIGGER IF EXISTS trigger_check_stock_after_update ON partner_products;
DROP FUNCTION IF EXISTS decrease_product_stock();
DROP FUNCTION IF EXISTS restore_product_stock();
DROP FUNCTION IF EXISTS decrease_stock_on_order_insert();
DROP FUNCTION IF EXISTS restore_stock_on_order_cancel();
DROP FUNCTION IF EXISTS check_and_disable_product();

-- ============================================
-- FUNCIÓN 1: Descontar stock al CREAR orden
-- ============================================
CREATE OR REPLACE FUNCTION decrease_stock_on_order_insert()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  product_id UUID;
  product_quantity INTEGER;
  current_stock INTEGER;
BEGIN
  -- Solo procesar órdenes de productos
  IF NEW.order_type = 'product_purchase' THEN
    
    RAISE NOTICE '📦 Procesando descuento de stock para orden %', NEW.id;
    
    -- Iterar sobre los items de la orden
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Extraer ID y cantidad del producto
      product_id := (item->>'id')::UUID;
      product_quantity := (item->>'quantity')::INTEGER;
      
      RAISE NOTICE '  - Producto: %, Cantidad: %', product_id, product_quantity;
      
      -- Obtener stock actual del producto
      SELECT stock INTO current_stock
      FROM partner_products
      WHERE id = product_id;
      
      -- Verificar que el producto existe
      IF current_stock IS NULL THEN
        RAISE WARNING '⚠️  Producto % no encontrado', product_id;
        CONTINUE;
      END IF;
      
      -- Verificar que hay suficiente stock
      IF current_stock < product_quantity THEN
        RAISE WARNING '❌ Stock insuficiente para producto %. Disponible: %, Solicitado: %', 
          product_id, current_stock, product_quantity;
        
        -- Marcar la orden con error de stock
        UPDATE orders
        SET status = 'insufficient_stock',
            updated_at = NOW()
        WHERE id = NEW.id;
        
        RETURN NEW;
      END IF;
      
      -- Descontar el stock
      UPDATE partner_products
      SET stock = stock - product_quantity,
          updated_at = NOW()
      WHERE id = product_id;
      
      RAISE NOTICE '✅ Stock descontado: Producto %, Nueva cantidad: %', 
        product_id, current_stock - product_quantity;
    END LOOP;
    
    RAISE NOTICE '✅ Descuento de stock completado para orden %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN 2: Restaurar stock al CANCELAR orden
-- ============================================
CREATE OR REPLACE FUNCTION restore_stock_on_order_cancel()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  product_id UUID;
  product_quantity INTEGER;
BEGIN
  -- Solo restaurar si la orden cambia a 'cancelled' Y es una orden de productos
  IF NEW.status = 'cancelled' AND 
     OLD.status != 'cancelled' AND
     NEW.order_type = 'product_purchase' THEN
    
    RAISE NOTICE '🔄 Restaurando stock para orden cancelada %', NEW.id;
    
    -- Iterar sobre los items de la orden
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Extraer ID y cantidad del producto
      product_id := (item->>'id')::UUID;
      product_quantity := (item->>'quantity')::INTEGER;
      
      RAISE NOTICE '  + Producto: %, Cantidad a restaurar: %', product_id, product_quantity;
      
      -- Restaurar el stock
      UPDATE partner_products
      SET stock = stock + product_quantity,
          updated_at = NOW()
      WHERE id = product_id;
      
      RAISE NOTICE '✅ Stock restaurado para producto %', product_id;
    END LOOP;
    
    RAISE NOTICE '✅ Restauración de stock completada para orden %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCIÓN 3: Desactivar/Activar producto según stock
-- ============================================
CREATE OR REPLACE FUNCTION check_and_disable_product()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el stock llega a 0 o menos, desactivar el producto
  IF NEW.stock <= 0 AND (OLD.stock IS NULL OR OLD.stock > 0) THEN
    NEW.is_active := false;
    RAISE NOTICE '🚫 Producto % desactivado por falta de stock', NEW.id;
  
  -- Si el stock vuelve a ser positivo, reactivar el producto
  ELSIF NEW.stock > 0 AND (OLD.stock IS NULL OR OLD.stock <= 0) THEN
    NEW.is_active := true;
    RAISE NOTICE '✅ Producto % reactivado con stock: %', NEW.id, NEW.stock;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CREAR TRIGGERS
-- ============================================

-- Trigger 1: Descontar stock al CREAR orden
CREATE TRIGGER trigger_decrease_stock_on_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION decrease_stock_on_order_insert();

-- Trigger 2: Restaurar stock al CANCELAR orden
CREATE TRIGGER trigger_restore_stock_on_cancel
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION restore_stock_on_order_cancel();

-- Trigger 3: Desactivar/Activar producto según stock
CREATE TRIGGER trigger_check_stock_after_update
  BEFORE UPDATE OF stock ON partner_products
  FOR EACH ROW
  EXECUTE FUNCTION check_and_disable_product();

-- ============================================
-- DOCUMENTACIÓN
-- ============================================
COMMENT ON FUNCTION decrease_stock_on_order_insert() IS 
  'Descuenta automáticamente el stock de productos al CREAR una orden';

COMMENT ON FUNCTION restore_stock_on_order_cancel() IS 
  'Restaura automáticamente el stock cuando una orden se CANCELA';

COMMENT ON FUNCTION check_and_disable_product() IS 
  'Desactiva productos cuando stock=0 y los reactiva cuando vuelve a haber stock';

COMMENT ON TRIGGER trigger_decrease_stock_on_insert ON orders IS 
  'Descuenta stock al momento de crear la orden (INSERT)';

COMMENT ON TRIGGER trigger_restore_stock_on_cancel ON orders IS 
  'Restaura stock cuando una orden cambia a status=cancelled';

COMMENT ON TRIGGER trigger_check_stock_after_update ON partner_products IS 
  'Desactiva/Activa productos automáticamente según disponibilidad de stock';
