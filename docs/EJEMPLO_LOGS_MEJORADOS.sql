-- ========================================
-- EJEMPLO DE LOGS MEJORADOS
-- Nuevos campos capturados en audit_logs
-- ========================================

-- 📋 EJEMPLO 1: LOGIN_FAILED
-- Ahora captura: user_email, error_message, resource_type, IP, detalles completos
INSERT INTO audit_logs (
  user_id,
  user_email,
  action,
  resource_type,
  success,
  error_message,
  ip_address,
  user_agent,
  details
) VALUES (
  NULL,  -- Sin autenticar
  'usuario@example.com',  -- ✅ Email capturado
  'LOGIN_FAILED',
  'user',  -- ✅ Tipo de recurso
  false,
  'Invalid login credentials',  -- ✅ Mensaje de error
  '190.123.45.67',  -- ✅ IP real del usuario
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
  jsonb_build_object(
    'email', 'usuario@example.com',
    'reason', 'Invalid login credentials',
    'method', 'email_password',
    'error_code', 'invalid_credentials',
    'platform', jsonb_build_object(
      'os', 'ios',
      'version', '15.0',
      'isTV', false,
      'isTesting', false
    ),
    'timestamp', '2026-02-07T10:30:00.000Z'
  )
);

-- 📋 EJEMPLO 2: LOGIN exitoso
-- Captura: user_id, user_email, resource_id, detalles del usuario
INSERT INTO audit_logs (
  user_id,
  user_email,
  action,
  resource_type,
  resource_id,
  success,
  ip_address,
  user_agent,
  details
) VALUES (
  '7d6857c6-7f52-4d19-8c4f-ed82efb6697b',  -- ✅ UUID del usuario
  'usuario@example.com',  -- ✅ Email
  'LOGIN',
  'user',
  '7d6857c6-7f52-4d19-8c4f-ed82efb6697b',  -- ✅ Resource ID = user_id
  true,
  '190.123.45.67',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
  jsonb_build_object(
    'email', 'usuario@example.com',
    'method', 'email_password',
    'is_owner', true,
    'is_partner', false,
    'display_name', 'Juan Pérez',  -- ✅ Nombre del usuario
    'platform', jsonb_build_object(
      'os', 'ios',
      'version', '15.0'
    ),
    'timestamp', '2026-02-07T10:31:00.000Z'
  )
);

-- 📋 EJEMPLO 3: BOOKING_CREATE
-- Ahora incluye: customer info, partner info, amounts, IDs
INSERT INTO audit_logs (
  user_id,
  user_email,
  action,
  resource_type,
  resource_id,
  success,
  ip_address,
  details
) VALUES (
  '7d6857c6-7f52-4d19-8c4f-ed82efb6697b',
  'cliente@example.com',  -- ✅ Email del cliente
  'BOOKING_CREATE',
  'booking',
  'booking-uuid-123',  -- ✅ ID del booking
  true,
  '190.123.45.67',
  jsonb_build_object(
    'service_name', 'Paseo Premium 60 min',
    'service_id', 'service-uuid-456',  -- ✅ ID del servicio
    'partner_name', 'Paseadores Pro',
    'partner_id', 'partner-uuid-789',  -- ✅ ID del partner
    'pet_name', 'Luna',
    'pet_id', 'pet-uuid-111',  -- ✅ ID de la mascota
    'customer_name', 'Juan Pérez',  -- ✅ Nombre del cliente
    'customer_email', 'cliente@example.com',  -- ✅ Email del cliente
    'date', '2026-02-10T14:00:00.000Z',
    'time', '14:00',
    'amount', 1500.00,  -- ✅ Monto total
    'commission', 300.00,  -- ✅ Comisión
    'partner_amount', 1200.00,  -- ✅ Monto para el partner
    'order_id', 'order-uuid-222',  -- ✅ ID de la orden
    'platform', jsonb_build_object(
      'os', 'android',
      'version', '12'
    ),
    'timestamp', '2026-02-07T10:35:00.000Z'
  )
);

-- 📋 EJEMPLO 4: PAYMENT_SUCCESS
-- Incluye: order details completos, partner info, customer info
INSERT INTO audit_logs (
  user_id,
  user_email,
  action,
  resource_type,
  resource_id,
  success,
  ip_address,
  details
) VALUES (
  '7d6857c6-7f52-4d19-8c4f-ed82efb6697b',
  'cliente@example.com',
  'PAYMENT_SUCCESS',
  'payment',
  'order-uuid-222',  -- ✅ ID de la orden
  true,
  '190.123.45.67',
  jsonb_build_object(
    'order_id', 'order-uuid-222',
    'order_number', 'ORD-2026-0207-001',  -- ✅ Número de orden
    'amount', 1500.00,
    'payment_method', 'mercadopago',
    'order_type', 'service_booking',
    'partner_id', 'partner-uuid-789',  -- ✅ ID del partner
    'partner_name', 'Paseadores Pro',
    'customer_id', '7d6857c6-7f52-4d19-8c4f-ed82efb6697b',
    'service_name', 'Paseo Premium 60 min',
    'items_count', 1,  -- ✅ Cantidad de items
    'created_at', '2026-02-07T10:35:00.000Z',
    'platform', jsonb_build_object(
      'os', 'android',
      'version', '12'
    ),
    'timestamp', '2026-02-07T10:40:00.000Z'
  )
);

-- 📋 EJEMPLO 5: PAYMENT_FAILED
-- Ahora con: error_message, status previo, razón detallada
INSERT INTO audit_logs (
  user_id,
  user_email,
  action,
  resource_type,
  resource_id,
  success,
  error_message,
  ip_address,
  details
) VALUES (
  '7d6857c6-7f52-4d19-8c4f-ed82efb6697b',
  'cliente@example.com',
  'PAYMENT_FAILED',
  'payment',
  'order-uuid-333',
  false,  -- ✅ Indica fallo
  'User cancelled or payment declined',  -- ✅ Mensaje de error
  '190.123.45.67',
  jsonb_build_object(
    'order_id', 'order-uuid-333',
    'order_number', 'ORD-2026-0207-002',
    'amount', 2500.00,
    'payment_method', 'mercadopago',
    'order_type', 'product_purchase',
    'partner_id', 'partner-uuid-555',
    'partner_name', 'Tienda Mascotas',
    'customer_id', '7d6857c6-7f52-4d19-8c4f-ed82efb6697b',
    'reason', 'User cancelled or payment declined',
    'status_before_cancel', 'pending_payment',  -- ✅ Estado previo
    'created_at', '2026-02-07T10:38:00.000Z',
    'platform', jsonb_build_object(
      'os', 'android',
      'version', '12'
    ),
    'timestamp', '2026-02-07T10:41:00.000Z'
  )
);

-- ========================================
-- QUERIES DE ANÁLISIS MEJORADOS
-- ========================================

-- 1. Ver todos los LOGIN_FAILED con email e IP
SELECT 
  created_at,
  user_email,  -- ✅ Ahora siempre capturado
  ip_address,  -- ✅ IP real del usuario
  error_message,
  details->>'reason' as reason,
  details->>'error_code' as error_code,
  details->'platform'->>'os' as platform_os
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
ORDER BY created_at DESC;

-- 2. Análisis de intentos fallidos por IP
SELECT 
  ip_address,  -- ✅ Detectar múltiples intentos desde misma IP
  user_email,
  COUNT(*) as intentos,
  array_agg(DISTINCT error_message) as errores,
  MIN(created_at) as primer_intento,
  MAX(created_at) as ultimo_intento
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY ip_address, user_email
HAVING COUNT(*) > 5  -- Alertar si más de 5 intentos
ORDER BY intentos DESC;

-- 3. Auditoría completa de un usuario
SELECT 
  created_at,
  action,
  resource_type,
  resource_id,
  success,
  error_message,
  ip_address,
  details->>'platform' as platform,
  details
FROM audit_logs
WHERE user_email = 'cliente@example.com'
ORDER BY created_at DESC
LIMIT 50;

-- 4. Análisis de pagos fallidos con detalles
SELECT 
  created_at,
  user_email,
  ip_address,
  details->>'order_number' as order_number,
  details->>'amount' as amount,
  details->>'partner_name' as partner,
  details->>'reason' as reason,
  details->>'status_before_cancel' as prev_status,
  error_message
FROM audit_logs
WHERE action = 'PAYMENT_FAILED'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 5. Bookings por partner con información completa
SELECT 
  details->>'partner_name' as partner,
  details->>'partner_id' as partner_id,
  COUNT(*) as total_bookings,
  SUM((details->>'amount')::numeric) as revenue_total,
  SUM((details->>'commission')::numeric) as commission_total,
  SUM((details->>'partner_amount')::numeric) as partner_earnings,
  array_agg(DISTINCT user_email) as customers
FROM audit_logs
WHERE action = 'BOOKING_CREATE'
  AND success = true
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY details->>'partner_name', details->>'partner_id'
ORDER BY total_bookings DESC;

-- ========================================
-- VENTAJAS DE LA MEJORA
-- ========================================
/*
✅ user_email: Siempre capturado, incluso sin autenticación
✅ ip_address: IP real del usuario para detectar patrones
✅ error_message: Mensajes de error claros
✅ resource_type: Tipo de recurso afectado
✅ resource_id: ID específico del recurso
✅ details completos: Toda la info relevante en JSON
✅ platform info: OS, versión, tipo de dispositivo
✅ IDs relacionados: customer_id, partner_id, service_id, etc.
✅ Montos financieros: amount, commission, partner_amount
✅ Timestamps: created_at en details para correlación

AHORA PODEMOS:
- Detectar ataques de fuerza bruta por IP
- Rastrear toda la actividad de un usuario
- Analizar revenue por partner
- Identificar problemas de pago
- Debugging completo con contexto total
*/
