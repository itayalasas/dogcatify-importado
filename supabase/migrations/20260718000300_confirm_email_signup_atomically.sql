-- Confirm the custom email flow in one transaction for token + profile.
-- Auth is still updated afterward by the edge function, but the DB state
-- now becomes all-or-nothing for the two critical records.

CREATE OR REPLACE FUNCTION public.confirm_email_signup_atomically(
  p_token_hash text,
  p_type text DEFAULT 'signup'
)
RETURNS TABLE (
  confirmation_id uuid,
  user_id uuid,
  email text,
  already_confirmed boolean,
  confirmed_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmation public.email_confirmations%ROWTYPE;
  v_token text := trim(coalesce(p_token_hash, ''));
  v_type text := lower(trim(coalesce(p_type, 'signup')));
  v_now timestamp with time zone := now();
  v_rows integer;
BEGIN
  IF v_token = '' THEN
    RAISE EXCEPTION 'TOKEN_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_confirmation
  FROM public.email_confirmations
  WHERE token_hash = v_token
    AND type = v_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_confirmation.is_confirmed IS NOT TRUE
     AND v_confirmation.expires_at IS NOT NULL
     AND v_confirmation.expires_at < v_now THEN
    RAISE EXCEPTION 'TOKEN_EXPIRED' USING ERRCODE = '22008';
  END IF;

  UPDATE public.email_confirmations
  SET
    is_confirmed = true,
    confirmed_at = COALESCE(confirmed_at, v_now)
  WHERE id = v_confirmation.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'TOKEN_UPDATE_ERROR' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET
    email_confirmed = true,
    email_confirmed_at = COALESCE(email_confirmed_at, v_now),
    updated_at = v_now
  WHERE id = v_confirmation.user_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    v_confirmation.id,
    v_confirmation.user_id,
    v_confirmation.email,
    v_confirmation.is_confirmed,
    COALESCE(v_confirmation.confirmed_at, v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_email_signup_atomically(text, text) TO service_role;
