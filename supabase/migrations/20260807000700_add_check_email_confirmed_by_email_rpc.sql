-- app/auth/confirm.tsx checks (pre-auth, by email) whether an account is
-- already confirmed in two places — used to show a friendlier message when a
-- confirmation token was already used. It read profiles directly with the
-- anon client, which no longer works now that profiles has no anon policy at
-- all. Only exposes the two booleans/name needed for that UX, not the full
-- row.
CREATE OR REPLACE FUNCTION public.check_email_confirmation_status(p_email text)
RETURNS TABLE (
  email_confirmed boolean,
  display_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email_confirmed, display_name
  FROM public.profiles
  WHERE email = lower(trim(coalesce(p_email, '')));
$$;

GRANT EXECUTE ON FUNCTION public.check_email_confirmation_status(text) TO anon, authenticated;
