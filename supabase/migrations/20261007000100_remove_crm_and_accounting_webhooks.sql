-- Quita la integración vieja con el CRM externo y el sistema contable.
--
-- Las órdenes dejaban de enviarse a send-order-to-crm y send-order-to-accounting
-- desde estos triggers. Las Edge Functions también se quitaron del repo.
--
-- Las tablas de logs (crm_webhook_logs, crm_webhook_debug_logs y
-- accounting_webhook_logs) se conservan con su historial. Se pueden borrar más
-- adelante con DROP TABLE si ya no hacen falta.

DROP TRIGGER IF EXISTS order_created_webhook ON public.orders;
DROP TRIGGER IF EXISTS order_updated_webhook ON public.orders;

DROP FUNCTION IF EXISTS public.trigger_crm_and_accounting_webhook();
DROP FUNCTION IF EXISTS public.trigger_crm_webhook();
