-- Test simple: verificar si el trigger se ejecuta

-- Primero, ver el estado actual de la orden
SELECT 
  id,
  payment_status,
  payment_id,
  customer_id
FROM orders 
WHERE id = 'f9a69b49-3560-4b68-b0d0-1fdfd7ebde9f';

-- Cambiar payment_status a NULL primero para asegurar que OLD es diferente de NEW
UPDATE orders 
SET payment_status = NULL
WHERE id = 'f9a69b49-3560-4b68-b0d0-1fdfd7ebde9f';

-- Ahora cambiar a 'approved' (esto DEBE disparar el trigger)
UPDATE orders 
SET payment_status = 'approved',
    payment_id = 'test_payment_' || floor(random() * 1000)::text
WHERE id = 'f9a69b49-3560-4b68-b0d0-1fdfd7ebde9f';

-- Ver resultado
SELECT 
  id,
  payment_status,
  payment_id,
  customer_id
FROM orders 
WHERE id = 'f9a69b49-3560-4b68-b0d0-1fdfd7ebde9f';
