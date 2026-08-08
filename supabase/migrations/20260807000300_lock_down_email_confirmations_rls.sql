-- Security hardening: email_confirmations had "Public can verify tokens" and
-- "Public can confirm tokens" policies granting SELECT/UPDATE to anon with
-- USING(true) — anyone could dump or tamper with every user's signup and
-- password-reset tokens via a plain REST call, with no token knowledge
-- required at all.
--
-- The only legitimate anon read was app/auth/reset-password.tsx validating a
-- reset link before showing the form (needs user_id + email for that exact
-- token). The anon UPDATE was unused by the client entirely (both existing
-- .update() calls went through the now-removed client-side service_role
-- client). Replace both with a SECURITY DEFINER function scoped to a single
-- token, same pattern as confirm_email_signup_atomically.

CREATE OR REPLACE FUNCTION public.validate_confirmation_token(
  p_token_hash text,
  p_type text DEFAULT 'password_reset'
)
RETURNS TABLE (
  user_id uuid,
  email text,
  is_valid boolean,
  is_confirmed boolean,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmation public.email_confirmations%ROWTYPE;
  v_token text := trim(coalesce(p_token_hash, ''));
  v_type text := lower(trim(coalesce(p_type, 'password_reset')));
BEGIN
  IF v_token = '' THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_confirmation
  FROM public.email_confirmations
  WHERE token_hash = v_token
    AND type = v_type;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_confirmation.user_id,
    v_confirmation.email,
    (
      v_confirmation.is_confirmed IS NOT TRUE
      AND v_confirmation.expires_at IS NOT NULL
      AND v_confirmation.expires_at > now()
    ),
    v_confirmation.is_confirmed,
    v_confirmation.expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_confirmation_token(text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can verify tokens" ON public.email_confirmations;
DROP POLICY IF EXISTS "Public can confirm tokens" ON public.email_confirmations;
