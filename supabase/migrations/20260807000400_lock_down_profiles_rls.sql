-- Security hardening: profiles had "Enable read access for all users"
-- USING(true) with no role restriction — any unauthenticated REST call could
-- read every user's email, phone, home address, exact GPS coordinates
-- (latitud/longitud), push/FCM tokens, and is_admin flag.
--
-- Verified against client usage first: most reads are the caller's own row
-- (fine with auth.uid() = id). A handful of legitimate cross-user reads only
-- need display_name/photo_url/is_partner/followers/following (review author
-- cards, chat participant names, followers list, follow-status checks) — a
-- public view covers those without exposing anything sensitive. Admin
-- screens (analytics, requests, FCM broadcast) need broader access, gated by
-- is_admin. Reads needing more than that (email search, partner-customer
-- contact, GPS "nearby pets") get their own SECURITY DEFINER functions in
-- later migrations, not blanket table access.

DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Users can read their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_admin = true
  )
);

-- Public, non-sensitive subset used for review authors, chat participant
-- names, the followers list, and follow-status checks. Deliberately excludes
-- email, phone, address, coordinates, and push/FCM tokens.
--
-- security_invoker is deliberately left at its default (false/owner-rights):
-- the whole point of this view is to expose these specific safe columns for
-- ALL rows regardless of the caller, bypassing the now-restrictive
-- "own row only" RLS on the base table. An invoker-rights view would just
-- re-apply that same restriction and defeat the purpose.
CREATE OR REPLACE VIEW public.profiles_public
AS
SELECT id, display_name, photo_url, is_partner, is_owner, followers, following
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
