/*
  # Corregir orden de ejecución de triggers

  1. Problema
    - Múltiples triggers BEFORE UPDATE pueden causar conflictos
    - El trigger de updated_at y el de desactivación compiten

  2. Solución
    - Eliminar actualización de updated_at de los triggers de stock
    - Dejar que el trigger automático de updated_at lo maneje
    - Simplificar la función de desactivación de productos

  3. Triggers Afectados
    - `decrease_stock_on_order_insert`: Ya no actualiza updated_at manualmente
    - `restore_stock_on_order_cancel`: Ya no actualiza updated_at manualmente
    - `check_and_disable_product`: Se mantiene como BEFORE UPDATE
*/

-- ============================================
-- RECREAR FUNCIÓN 1: Descontar stock (sin updated_at)
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
      
      -- Descontar el stock (updated_at se actualiza automáticamente por su trigger)
      UPDATE partner_products
      SET stock = stock - product_quantity
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
-- RECREAR FUNCIÓN 2: Restaurar stock (sin updated_at)
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
      
      -- Restaurar el stock (updated_at se actualiza automáticamente por su trigger)
      UPDATE partner_products
      SET stock = stock + product_quantity
      WHERE id = product_id;
      
      RAISE NOTICE '✅ Stock restaurado para producto %', product_id;
    END LOOP;
    
    RAISE NOTICE '✅ Restauración de stock completada para orden %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DOCUMENTACIÓN ACTUALIZADA
-- ============================================
COMMENT ON FUNCTION decrease_stock_on_order_insert() IS 
  'Descuenta automáticamente el stock de productos al CREAR una orden. El campo updated_at se actualiza automáticamente por su propio trigger.';

COMMENT ON FUNCTION restore_stock_on_order_cancel() IS 
  'Restaura automáticamente el stock cuando una orden se CANCELA. El campo updated_at se actualiza automáticamente por su propio trigger.';
