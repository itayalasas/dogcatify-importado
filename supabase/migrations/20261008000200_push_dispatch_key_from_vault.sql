-- Las notificaciones push programadas (cambios de estado de pedidos, chat de
-- pedidos, recordatorios) las envía send-scheduled-notifications, que se llama
-- desde la base con la service role key. Hasta ahora esa clave se leía de un
-- parámetro de Postgres (app.settings.service_role_key) que en Supabase no se
-- puede configurar sin superusuario, así que la llamada salía sin clave y la
-- función respondía 401: ningún push programado llegaba.
--
-- Ahora la clave se lee de Supabase Vault (secreto 'service_role_key'), con el
-- parámetro viejo como respaldo. Para configurarlo, una vez por proyecto:
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--   insert into public.admin_settings (key, value)
--   values ('cron_project_url', jsonb_build_object('url', 'https://<ref>.supabase.co'))
--   on conflict (key) do update set value = excluded.value, updated_at = now();
--
-- Y para revisar que todo esté bien:  select public.push_setup_status();

CREATE OR REPLACE FUNCTION public.get_service_role_key_for_cron() RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets
     WHERE name = 'service_role_key'
     ORDER BY created_at DESC
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;

  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('app.settings.service_role_key', true);
  END IF;
  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('supabase.service_role_key', true);
  END IF;

  RETURN NULLIF(v_key, '');
END;
$$;

REVOKE ALL ON FUNCTION public.get_service_role_key_for_cron() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_scheduled_notifications_cron() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  supabase_url text := COALESCE(
    (SELECT value->>'url' FROM public.admin_settings WHERE key = 'cron_project_url'),
    'https://hpvzjuionqvgxlvhyqgz.supabase.co'
  );
  service_role_key text := public.get_service_role_key_for_cron();
BEGIN
  IF service_role_key IS NULL THEN
    RAISE WARNING 'send_scheduled_notifications_cron: falta el secreto service_role_key en Vault; no se envían push';
    RETURN;
  END IF;

  SELECT INTO request_id net.http_post(
    url := supabase_url || '/functions/v1/send-scheduled-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );

  RAISE NOTICE 'send_scheduled_notifications_cron queued request_id: % (url: %)', request_id, supabase_url;
END;
$$;

-- Diagnóstico de push, para correr en el SQL Editor.
CREATE OR REPLACE FUNCTION public.push_setup_status() RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := (SELECT value->>'url' FROM public.admin_settings WHERE key = 'cron_project_url');
  v_cron boolean := false;
  v_recent jsonb;
  v_responses jsonb;
BEGIN
  BEGIN
    SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send_scheduled_notifications') INTO v_cron;
  EXCEPTION WHEN OTHERS THEN
    v_cron := false;
  END;

  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_recent FROM (
    SELECT notification_type, status, error_message, created_at
      FROM public.scheduled_notifications
     ORDER BY created_at DESC
     LIMIT 8
  ) r;

  BEGIN
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) INTO v_responses FROM (
      SELECT status_code, left(content::text, 200) AS content, created
        FROM net._http_response
       ORDER BY created DESC
       LIMIT 5
    ) r;
  EXCEPTION WHEN OTHERS THEN
    v_responses := '[]'::jsonb;
  END;

  RETURN jsonb_build_object(
    'project_url', COALESCE(v_url, 'SIN CONFIGURAR (usa la URL de producción)'),
    'service_role_key_en_vault', public.get_service_role_key_for_cron() IS NOT NULL,
    'cron_programado', v_cron,
    'usuarios_con_token', (SELECT count(*) FROM public.profiles WHERE fcm_token IS NOT NULL OR push_token IS NOT NULL),
    'ultimas_notificaciones', v_recent,
    'ultimas_respuestas_http', v_responses
  );
END;
$$;

REVOKE ALL ON FUNCTION public.push_setup_status() FROM PUBLIC, anon, authenticated;
