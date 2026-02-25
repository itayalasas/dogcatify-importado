-- Hardening: asegurar ejecución periódica de notificaciones programadas

CREATE OR REPLACE FUNCTION public.send_scheduled_notifications_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  supabase_url text := 'https://hpvzjuionqvgxlvhyqgz.supabase.co';
  service_role_key text;
BEGIN
  service_role_key := current_setting('app.settings.service_role_key', true);
  IF service_role_key IS NULL OR service_role_key = '' THEN
    service_role_key := current_setting('supabase.service_role_key', true);
  END IF;

  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/send-scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, ''),
      'apikey', COALESCE(service_role_key, '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );

  RAISE NOTICE 'send_scheduled_notifications_cron queued request_id: %', request_id;
END;
$$;

ALTER FUNCTION public.send_scheduled_notifications_cron() OWNER TO postgres;
GRANT ALL ON FUNCTION public.send_scheduled_notifications_cron() TO anon;
GRANT ALL ON FUNCTION public.send_scheduled_notifications_cron() TO authenticated;
GRANT ALL ON FUNCTION public.send_scheduled_notifications_cron() TO service_role;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'send_scheduled_notifications'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'send_scheduled_notifications',
    '*/15 * * * *',
    'SELECT public.send_scheduled_notifications_cron();'
  );
END;
$$;
