/*
  # Desactivar Sistema de Webhooks Antiguo

  1. Objetivo
    - Desactivar el sistema antiguo de webhooks a webhook_subscriptions
    - Dejar solo activo el nuevo sistema de webhooks al CRM
    - Mantener las tablas por si se necesitan en el futuro

  2. Acciones
    - Eliminar triggers antiguos: order_created_webhook, order_updated_webhook
    - Mantener la función trigger_webhook_notification() pero sin triggers activos
    - El nuevo sistema (trigger_crm_webhook) seguirá funcionando

  3. Sistema Activo
    - ✅ order_created_crm_webhook -> trigger_crm_webhook() -> send-order-to-crm
    - ✅ order_updated_crm_webhook -> trigger_crm_webhook() -> send-order-to-crm

  4. Sistema Desactivado
    - ❌ order_created_webhook -> trigger_webhook_notification() -> notify-order-webhook
    - ❌ order_updated_webhook -> trigger_webhook_notification() -> notify-order-webhook

  5. Notas
    - Las tablas webhook_subscriptions y webhook_logs se mantienen
    - Se pueden reactivar manualmente si es necesario
    - La Edge Function notify-order-webhook sigue disponible
*/

-- Eliminar triggers del sistema antiguo
DROP TRIGGER IF EXISTS order_created_webhook ON orders;
DROP TRIGGER IF EXISTS order_updated_webhook ON orders;

-- Comentar que los triggers fueron desactivados
COMMENT ON FUNCTION trigger_webhook_notification() IS
  '[DESACTIVADO] Función de webhook antiguo que enviaba a webhook_subscriptions. Los triggers fueron removidos. Sistema activo: trigger_crm_webhook()';

-- Confirmar que el nuevo sistema está activo
DO $$
BEGIN
  -- Verificar que los nuevos triggers existen
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'order_created_crm_webhook'
  ) THEN
    RAISE EXCEPTION 'ERROR: Trigger order_created_crm_webhook no existe. Aplica primero la migración 20251113011237_create_crm_webhook_system.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'order_updated_crm_webhook'
  ) THEN
    RAISE EXCEPTION 'ERROR: Trigger order_updated_crm_webhook no existe. Aplica primero la migración 20251113011237_create_crm_webhook_system.sql';
  END IF;

  RAISE NOTICE '✅ Sistema antiguo desactivado correctamente';
  RAISE NOTICE '✅ Sistema nuevo (CRM) está activo y funcionando';
END $$;
