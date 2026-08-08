-- Security hardening: partners.mercadopago_config holds each business's real
-- Mercado Pago access_token/refresh_token, and is readable by ANY
-- authenticated user via "Authenticated users can read active partners"
-- USING (is_active = true) — no column restriction, so a plain select('*')
-- from any logged-in user (or the buyer's own client during checkout, which
-- reads the SELLER's token to call the MP API directly from the device)
-- exposes every active partner's live payment credentials.
--
-- Fix: move the credential out of partners entirely, into a table keyed by
-- user_id (confirmed today's actual model — mercadopago-oauth/index.ts and
-- disconnectPartnerMercadoPago() both already treat this as "one credential
-- per user_id, shared across all of that user's businesses", not per
-- partner row). Dropping the column means every existing select('*') on
-- partners automatically stops leaking it, with zero changes needed at
-- those call sites.

CREATE TABLE public.partner_payment_credentials (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  public_key text,
  mp_user_id text,
  connected_at timestamp with time zone,
  is_oauth boolean DEFAULT false,
  is_test_mode boolean DEFAULT false,
  token_type text,
  expires_in integer,
  live_mode boolean,
  last_refresh_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.partner_payment_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own MP credentials"
ON public.partner_payment_credentials
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- One row per user_id: take the most recently updated non-empty config
-- among that user's partner rows (today they're always identical copies,
-- per the "all businesses share one config" model, but guard against drift
-- with DISTINCT ON + ORDER BY just in case).
INSERT INTO public.partner_payment_credentials (
  user_id, access_token, refresh_token, public_key, mp_user_id,
  connected_at, is_oauth, is_test_mode, token_type, expires_in,
  live_mode, last_refresh_at, updated_at
)
SELECT DISTINCT ON (user_id)
  user_id,
  mercadopago_config->>'access_token',
  mercadopago_config->>'refresh_token',
  mercadopago_config->>'public_key',
  mercadopago_config->>'user_id',
  NULLIF(mercadopago_config->>'connected_at', '')::timestamptz,
  COALESCE((mercadopago_config->>'is_oauth')::boolean, false),
  COALESCE((mercadopago_config->>'is_test_mode')::boolean, false),
  mercadopago_config->>'token_type',
  NULLIF(mercadopago_config->>'expires_in', '')::integer,
  (mercadopago_config->>'live_mode')::boolean,
  NULLIF(mercadopago_config->>'last_refresh_at', '')::timestamptz,
  COALESCE(NULLIF(mercadopago_config->>'updated_at', '')::timestamptz, updated_at)
FROM public.partners
WHERE mercadopago_config IS NOT NULL
  AND mercadopago_config != '{}'::jsonb
  AND mercadopago_config->>'access_token' IS NOT NULL
ORDER BY user_id, updated_at DESC
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.partners DROP COLUMN mercadopago_config;
