SELECT 
  id,
  total_amount,
  subtotal,
  iva_amount,
  tax_included,
  payment_data::jsonb->'transaction_amount' as mp_amount
FROM orders 
WHERE id = 'ac76d8d3-26b8-4c96-8955-931c2d84be4c';
