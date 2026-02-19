-- Verificar configuración del trigger y extensiones

-- 1. Verificar que pg_net esté instalada
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- 2. Verificar que el trigger existe
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'orders' 
  AND trigger_name = 'on_order_payment_confirmed_send_email';

-- 3. Verificar que la función existe
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'send_order_confirmation_email';

-- 4. Verificar si hay requests en la cola de pg_net
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;

-- 5. Probar el trigger manualmente con una orden específica
SELECT 
  o.id,
  o.payment_status,
  o.customer_id,
  p.email,
  p.display_name
FROM orders o
LEFT JOIN profiles p ON p.id = o.customer_id
WHERE o.id = 'f9a69b49-3560-4b68-b0d0-1fdfd7ebde9f';
