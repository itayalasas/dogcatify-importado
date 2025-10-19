/*
  # Sistema de Gestión de Stock Automático

  1. Nuevas Funciones
    - `decrease_product_stock()`: Descuenta el stock de productos cuando se crea/confirma una orden
    - `restore_product_stock()`: Restaura el stock cuando una orden se cancela

  2. Triggers
    - `trigger_decrease_stock_on_order_payment`: Se ejecuta cuando una orden cambia a 'paid' o 'completed'
    - `trigger_restore_stock_on_order_cancel`: Se ejecuta cuando una orden cambia a 'cancelled'

  3. Seguridad
    - Las funciones validan que haya suficiente stock antes de crear la orden
    - Se previenen stocks negativos
    - Los triggers solo se ejecutan en cambios de estado relevantes

  4. Notas Importantes
    - El stock se descuenta cuando el pago se confirma (status = 'paid')
    - El stock se restaura solo si la orden se cancela (status = 'cancelled')
    - Si no hay stock suficiente, la orden se marca como 'insufficient_stock'
*/

-- Función para descontar stock de productos cuando se paga una orden
CREATE OR REPLACE FUNCTION decrease_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  product_id UUID;
  product_quantity INTEGER;
  current_stock INTEGER;
BEGIN
  -- Solo descontar stock cuando la orden cambia a 'paid' o 'completed'
  IF NEW.status IN ('paid', 'completed') AND 
     OLD.status NOT IN ('paid', 'completed') AND
     NEW.order_type = 'product_purchase' THEN
    
    -- Iterar sobre los items de la orden
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Extraer ID y cantidad del producto
      product_id := (item->>'id')::UUID;
      product_quantity := (item->>'quantity')::INTEGER;
      
      -- Obtener stock actual del producto
      SELECT stock INTO current_stock
      FROM products
      WHERE id = product_id;
      
      -- Verificar que hay suficiente stock
      IF current_stock IS NULL OR current_stock < product_quantity THEN
        -- Si no hay stock suficiente, marcar la orden como 'insufficient_stock'
        UPDATE orders
        SET status = 'insufficient_stock',
            updated_at = NOW()
        WHERE id = NEW.id;
        
        RAISE NOTICE 'Stock insuficiente para producto %', product_id;
        RETURN NEW;
      END IF;
      
      -- Descontar el stock
      UPDATE products
      SET stock = stock - product_quantity,
          updated_at = NOW()
      WHERE id = product_id;
      
      RAISE NOTICE 'Stock descontado: Producto %, Cantidad %', product_id, product_quantity;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para restaurar stock de productos cuando se cancela una orden
CREATE OR REPLACE FUNCTION restore_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  product_id UUID;
  product_quantity INTEGER;
BEGIN
  -- Solo restaurar stock cuando la orden cambia a 'cancelled' desde un estado pagado
  IF NEW.status = 'cancelled' AND 
     OLD.status IN ('paid', 'completed') AND
     NEW.order_type = 'product_purchase' THEN
    
    -- Iterar sobre los items de la orden
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      -- Extraer ID y cantidad del producto
      product_id := (item->>'id')::UUID;
      product_quantity := (item->>'quantity')::INTEGER;
      
      -- Restaurar el stock
      UPDATE products
      SET stock = stock + product_quantity,
          updated_at = NOW()
      WHERE id = product_id;
      
      RAISE NOTICE 'Stock restaurado: Producto %, Cantidad %', product_id, product_quantity;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS trigger_decrease_stock_on_order_payment ON orders;
DROP TRIGGER IF EXISTS trigger_restore_stock_on_order_cancel ON orders;

-- Crear trigger para descontar stock cuando se paga una orden
CREATE TRIGGER trigger_decrease_stock_on_order_payment
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION decrease_product_stock();

-- Crear trigger para restaurar stock cuando se cancela una orden
CREATE TRIGGER trigger_restore_stock_on_order_cancel
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION restore_product_stock();

-- Agregar comentarios para documentación
COMMENT ON FUNCTION decrease_product_stock() IS 'Descuenta automáticamente el stock de productos cuando una orden se paga';
COMMENT ON FUNCTION restore_product_stock() IS 'Restaura automáticamente el stock de productos cuando una orden pagada se cancela';
