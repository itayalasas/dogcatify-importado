-- Verificar estructura y datos de la orden
SELECT 
  o.id,
  o.total_amount,
  o.subtotal,
  o.iva_amount,
  o.iva_rate,
  o.items,
  p.name as product_name,
  p.price as product_price,
  p.price_includes_tax,
  o.payment_data::jsonb->'transaction_amount' as mercadopago_amount
FROM orders o
LEFT JOIN products p ON p.id::text = ANY(SELECT jsonb_array_elements_text(o.items::jsonb->0->'id'))
WHERE o.id = 'ac76d8d3-26b8-4c96-8955-931c2d84be4c';

-- Ver los items de la orden
SELECT 
  id,
  items::jsonb as items_json
FROM orders
WHERE id = 'ac76d8d3-26b8-4c96-8955-931c2d84be4c';
