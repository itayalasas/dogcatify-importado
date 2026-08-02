-- Debug: Verificar el order_type de las órdenes recientes

-- 1. Ver órdenes recientes con su order_type
SELECT 
    id,
    order_type,
    payment_status,
    service_name,
    pet_name,
    appointment_date,
    appointment_time,
    created_at
FROM orders 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2. Ver qué está recibiendo la función del trigger
-- Ejecuta esto DESPUÉS de crear una cita desde la app:
SELECT 
    id AS order_id,
    order_type,
    CASE 
        WHEN order_type = 'service_booking' THEN '✅ CORRECTO - Debería usar agenda_confirmation'
        WHEN order_type = 'product_purchase' THEN '✅ CORRECTO - Debería usar shop_confirmation'
        WHEN order_type IS NULL THEN '❌ NULL - Se usará shop_confirmation por defecto'
        ELSE '⚠️ VALOR DESCONOCIDO: ' || order_type
    END as template_esperado,
    payment_status,
    service_name,
    created_at
FROM orders 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar si la columna order_type existe y su tipo
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name = 'order_type';
