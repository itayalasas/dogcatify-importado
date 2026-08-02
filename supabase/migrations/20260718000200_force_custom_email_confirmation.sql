-- New users must start as unconfirmed in the app until they validate the
-- confirmation email sent by DogCatiFy. We do not inherit Auth confirmation
-- into the app-level email confirmation flag.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_role text;
  v_is_owner boolean := true;
  v_is_partner boolean := false;
BEGIN
  v_account_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'account_role', 'owner'));

  IF v_account_role = 'partner' THEN
    v_is_owner := false;
    v_is_partner := true;
  ELSIF v_account_role = 'owner' THEN
    v_is_owner := true;
    v_is_partner := false;
  ELSE
    v_is_owner := COALESCE((NEW.raw_user_meta_data->>'is_owner')::boolean, true);
    v_is_partner := COALESCE((NEW.raw_user_meta_data->>'is_partner')::boolean, false);
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    is_owner,
    is_partner,
    email_confirmed,
    email_confirmed_at,
    onboarding_completed,
    followers,
    following,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_is_owner,
    v_is_partner,
    false,
    NULL,
    false,
    ARRAY[]::text[],
    ARRAY[]::text[],
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
