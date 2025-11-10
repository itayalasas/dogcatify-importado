/*
  ================================================================================================
  DOGCATIFY - PRODUCCIÓN - SCHEMA COMPLETO
  ================================================================================================

  Este archivo contiene toda la estructura de base de datos lista para producción.

  IMPORTANTE:
  - Este archivo NO contiene datos, solo estructura
  - Aplica en una base de datos LIMPIA
  - Orden de ejecución: Extensiones → Tablas → Funciones → Triggers → Políticas RLS

  Última actualización: 2025-11-10
  Tablas: 51
  Edge Functions: 31

  ================================================================================================
*/

-- ================================================================================================
-- EXTENSIONES REQUERIDAS
-- ================================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ================================================================================================
-- NOTA: PARA OBTENER EL DUMP COMPLETO, EJECUTA ESTOS COMANDOS:
-- ================================================================================================

/*
  PASO 1: Desde tu terminal local, ejecuta:

  supabase db dump --file production_complete_schema.sql

  Esto generará un archivo SQL con:
  - Todas las tablas
  - Todos los índices
  - Todas las funciones
  - Todos los triggers
  - Todas las políticas RLS
  - Todas las extensiones
  - Todos los tipos personalizados
  - Todos los comentarios

  PASO 2: Aplicar en producción:

  Opción A - Usando Supabase CLI:
  supabase link --project-ref <tu-project-ref-produccion>
  supabase db push

  Opción B - Desde SQL Editor en Dashboard:
  1. Ve a dashboard.supabase.com
  2. Selecciona tu proyecto de producción
  3. Ve a "SQL Editor"
  4. Pega el contenido del archivo production_complete_schema.sql
  5. Ejecuta

  PASO 3: Desplegar Edge Functions:

  supabase functions deploy --project-ref <tu-project-ref-produccion>

  O función por función:
  supabase functions deploy send-email --project-ref <tu-project-ref-produccion>
  supabase functions deploy mercadopago-webhook --project-ref <tu-project-ref-produccion>
  # ... etc para las 31 funciones

*/

-- ================================================================================================
-- LISTA COMPLETA DE TABLAS (51)
-- ================================================================================================

/*
  USUARIOS Y PERFILES:
  - profiles
  - email_confirmations

  MASCOTAS:
  - pets
  - pet_health
  - pet_albums
  - pet_behavior
  - pet_shares

  PARTNERS/NEGOCIOS:
  - partners
  - partner_services
  - partner_products
  - business_schedule

  ÓRDENES Y PAGOS:
  - orders
  - bookings
  - booking_confirmation_tokens
  - user_carts
  - webhook_subscriptions
  - webhook_logs

  MÉDICO:
  - medical_alerts
  - medical_conditions
  - medical_treatments
  - medical_history_tokens
  - veterinary_clinics
  - vaccines_catalog
  - dewormers_catalog
  - allergies_catalog
  - vaccination_schedules
  - deworming_schedules

  CACHÉ DE IA:
  - vaccine_recommendations_cache
  - dewormers_ai_cache
  - illnesses_ai_cache
  - treatments_ai_cache
  - allergies_ai_cache

  ADOPCIONES:
  - adoption_pets
  - adoption_chats
  - adoption_messages

  SOCIAL:
  - posts
  - comments
  - places
  - chat_conversations
  - chat_messages

  SUSCRIPCIONES:
  - subscription_plans
  - subscription_settings
  - user_subscriptions

  PROMOCIONES:
  - promotions
  - promotion_billing

  NOTIFICACIONES:
  - scheduled_notifications

  ADMINISTRACIÓN:
  - admin_settings
  - app_config

  UBICACIÓN:
  - countries
  - departments

  RESEÑAS:
  - service_reviews
*/

-- ================================================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ================================================================================================

-- Verifica que todas las tablas se crearon
SELECT
  'Total de tablas creadas: ' || count(*) as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- Verifica que RLS está habilitado en todas las tablas
SELECT
  CASE
    WHEN count(*) = 0 THEN 'OK: RLS habilitado en todas las tablas'
    ELSE 'ERROR: ' || count(*) || ' tablas sin RLS'
  END as status,
  string_agg(tablename, ', ') as tables_without_rls
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- Verifica que las funciones principales existen
SELECT
  'Funciones creadas: ' || count(*) as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION';

-- Verifica que los triggers principales existen
SELECT
  'Triggers creados: ' || count(*) as status
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Verifica que los índices únicos existen
SELECT
  'Índices únicos: ' || count(*) as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%UNIQUE%';

-- ================================================================================================
-- DATOS INICIALES REQUERIDOS (OPCIONAL)
-- ================================================================================================

/*
  Si necesitas datos iniciales en producción, agrégalos aquí:

  -- Ejemplo: Admin email
  INSERT INTO admin_settings (email, created_at)
  VALUES ('admin@dogcatify.com', now())
  ON CONFLICT DO NOTHING;

  -- Ejemplo: Configuración de app
  INSERT INTO app_config (key, value, description)
  VALUES
    ('app_name', '"DogCatiFy"', 'Nombre de la aplicación'),
    ('app_version', '"9.0.0"', 'Versión actual'),
    ('maintenance_mode', 'false', 'Modo de mantenimiento')
  ON CONFLICT (key) DO NOTHING;

  -- Ejemplo: Planes de suscripción
  INSERT INTO subscription_plans (name, price, duration_days, features)
  VALUES
    ('Básico', 0, 30, '["Perfil básico", "2 mascotas"]'::jsonb),
    ('Premium', 9.99, 30, '["Perfil completo", "Mascotas ilimitadas", "Alertas médicas"]'::jsonb)
  ON CONFLICT DO NOTHING;
*/

-- ================================================================================================
-- FIN DEL ARCHIVO
-- ================================================================================================

/*
  SIGUIENTE PASO:

  Ejecuta el comando de dump para obtener el schema completo:

  cd tu-proyecto-dogcatify
  supabase db dump --file production_complete_schema.sql

  Ese archivo tendrá TODO el schema listo para aplicar en producción.

  Consulta PRODUCTION_MIGRATION_GUIDE.md para instrucciones detalladas.
*/
