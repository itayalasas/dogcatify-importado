-- Security hardening: admin_settings had no RLS at all, only a blanket
-- "Enable read access for all users" USING(true) policy plus GRANT ALL to anon.
-- It holds both public feature flags (key='system_config', read pre-login by
-- app/_layout.tsx and app/(tabs)/partner-register.tsx) and the legacy Mercado
-- Pago admin marketplace token (key='mercadopago_config', includes a real
-- access_token) which must never be readable by anon/non-admin clients.

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.admin_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.admin_settings;
DROP POLICY IF EXISTS "Public can read system_config" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can manage admin settings" ON public.admin_settings;

-- Keep "Admin can manage all settings" (already correctly admin-only) as-is.

-- Public system_config row only: this is what app boot / partner registration need.
CREATE POLICY "Public can read system_config"
ON public.admin_settings
FOR SELECT
TO anon, authenticated
USING (key = 'system_config');

-- Everything else (including mercadopago_config) is admin-only for read/write,
-- via the standard is_admin column pattern used elsewhere in this project.
CREATE POLICY "Admins can manage admin settings"
ON public.admin_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);

-- Tighten table-level grants: anon only needs SELECT (row-gated to system_config
-- by the policy above); writes are only ever done by admins or service_role.
REVOKE ALL ON TABLE public.admin_settings FROM anon;
GRANT SELECT ON TABLE public.admin_settings TO anon;
REVOKE ALL ON TABLE public.admin_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_settings TO authenticated;

-- Public, read-only accessor for the Mercado Pago OAuth client_id — a public
-- identifier (used to build the authorization URL), not a secret. Lets the
-- client keep working without any direct SELECT on admin_settings.mercadopago_config
-- (which also holds the real access_token and must stay admin-only).
CREATE OR REPLACE FUNCTION public.get_mercadopago_public_client_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    value->>'client_id',
    value->>'clientId',
    value->>'oauth_client_id',
    value->>'app_id'
  )
  FROM public.admin_settings
  WHERE key = 'mercadopago_config';
$$;

GRANT EXECUTE ON FUNCTION public.get_mercadopago_public_client_id() TO anon, authenticated;
