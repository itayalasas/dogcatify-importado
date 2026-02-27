-- Verificación rápida de notificaciones de match/chat

-- 1) Constraints actuales en scheduled_notifications
SELECT conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'scheduled_notifications'
  AND conname IN (
    'scheduled_notifications_notification_type_check',
    'scheduled_notifications_reference_type_check'
  );

-- 2) Funciones de notificación
SELECT p.proname, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'create_pet_match_notifications',
    'create_pet_match_message_notification'
  );

-- 3) Triggers activos
SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trigger_create_pet_match_notifications',
    'trigger_create_pet_match_message_notification'
  )
ORDER BY event_object_table, trigger_name;

-- 4) Últimas notificaciones de match/chat
SELECT id, user_id, notification_type, reference_id, reference_type, status, error_message, created_at
FROM public.scheduled_notifications
WHERE notification_type IN ('pet_match_created', 'pet_match_message')
ORDER BY created_at DESC
LIMIT 50;
