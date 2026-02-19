-- Script para verificar cómo se crean las órdenes y si se envían emails

-- 1. Ver las últimas órdenes creadas con su payment_status inicial
SELECT 
    id,
    order_type,
    payment_status,
    payment_method,
    total_amount,
    customer_id,
    created_at,
    updated_at,
    CASE 
        WHEN created_at = updated_at THEN 'NO ACTUALIZADA'
        ELSE 'ACTUALIZADA'
    END as fue_actualizada
FROM orders 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC 
LIMIT 20;

-- 2. Ver si el trigger está activo
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'orders' 
  AND trigger_name = 'on_order_payment_confirmed_send_email';

-- 3. Ver las últimas peticiones HTTP (envío de emails)
SELECT 
    id,
    created,
    status_code,
    content::text as response,
    error_msg
FROM net._http_response 
WHERE created > NOW() - INTERVAL '7 days'
  AND (content::text LIKE '%send-email%' OR content::text LIKE '%send-invoice-email%')
ORDER BY created DESC 
LIMIT 10;

-- 4. Ver órdenes de tipo service_booking (citas) que deberían haber enviado email
SELECT 
    o.id,
    o.order_type,
    o.payment_status,
    o.service_name,
    o.pet_name,
    o.appointment_date,
    o.appointment_time,
    o.created_at,
    o.updated_at,
    p.email as customer_email,
    CASE 
        WHEN o.created_at = o.updated_at THEN 'INSERT ONLY - puede no haber disparado'
        ELSE 'UPDATE DETECTED'
    END as trigger_scenario
FROM orders o
LEFT JOIN profiles p ON p.id = o.customer_id
WHERE o.order_type = 'service_booking'
  AND o.payment_status IN ('paid', 'approved')
  AND o.created_at > NOW() - INTERVAL '7 days'
ORDER BY o.created_at DESC 
LIMIT 10;
