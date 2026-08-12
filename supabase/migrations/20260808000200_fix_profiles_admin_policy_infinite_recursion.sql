-- Bugfix: "Admins can read all profiles" (20260807000400) does
-- EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND
-- p.is_admin = true) as the USING clause of a SELECT policy ON
-- public.profiles itself. Evaluating that policy requires Postgres to
-- re-evaluate profiles' RLS for the inner SELECT, which re-enters this same
-- policy -> infinite recursion (error 42P17 "infinite recursion detected in
-- policy for relation profiles"). This broke EVERY read of profiles for
-- EVERY user (not just admins), including a user reading their own row,
-- because Postgres must evaluate all permissive SELECT policies to compute
-- the combined USING condition.
--
-- Fix: move the is_admin check into a SECURITY DEFINER function. Functions
-- created by migrations are owned by a role with bypassrls, so the query
-- inside the function does not re-trigger profiles' RLS, breaking the
-- recursion.

CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = p_user_id),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));
