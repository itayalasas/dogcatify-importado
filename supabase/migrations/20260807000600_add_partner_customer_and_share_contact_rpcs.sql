-- Etapa 6b: the remaining legitimate cross-user profile reads that need more
-- than profiles_public's safe columns (email, phone) get their own
-- SECURITY DEFINER functions that verify a real relationship exists first,
-- instead of relying on blanket table access.

-- app/partner/clients.tsx used to loop over every customer_id found in a
-- partner's bookings/orders and read the full profiles row (select('*')) for
-- each. Only display_name/email/photo_url/phone were actually used. This
-- returns just those columns, in one call, and only for customers who
-- genuinely have a booking or order with that partner.
CREATE OR REPLACE FUNCTION public.get_partner_customer_contacts(p_partner_id uuid)
RETURNS TABLE (
  customer_id uuid,
  display_name text,
  email text,
  photo_url text,
  phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.partners
    WHERE id = p_partner_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT pr.id, pr.display_name, pr.email, pr.photo_url, pr.phone
  FROM public.profiles pr
  WHERE pr.id IN (
    SELECT b.customer_id FROM public.bookings b WHERE b.partner_id = p_partner_id AND b.customer_id IS NOT NULL
    UNION
    SELECT o.customer_id FROM public.orders o WHERE o.partner_id = p_partner_id AND o.customer_id IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_customer_contacts(uuid) TO authenticated;

-- app/pets/share-pet.tsx: search for a user to share a pet with, by name or
-- email. Previously a direct SELECT on profiles (open to anon). Now
-- authenticated-only, and still excludes users who already have access.
CREATE OR REPLACE FUNCTION public.search_users_for_sharing(p_query text, p_pet_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term text := '%' || trim(coalesce(p_query, '')) || '%';
BEGIN
  IF trim(coalesce(p_query, '')) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pr.id, pr.display_name, pr.email
  FROM public.profiles pr
  WHERE pr.id <> auth.uid()
    AND (pr.display_name ILIKE v_term OR pr.email ILIKE v_term)
    AND NOT EXISTS (
      SELECT 1 FROM public.pet_shares ps
      WHERE ps.pet_id = p_pet_id
        AND ps.shared_with_user_id = pr.id
        AND ps.status <> 'rejected'
    )
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users_for_sharing(text, uuid) TO authenticated;

-- app/pets/share-pet.tsx: the "already shared with" list needs the shared
-- user's display_name/email, which PostgREST's embedded-resource join
-- (profiles!pet_shares_shared_with_user_id_fkey) can no longer read now that
-- profiles is locked down. Restricted to the pet's owner.
CREATE OR REPLACE FUNCTION public.get_pet_share_contacts(p_pet_id uuid)
RETURNS TABLE (
  id uuid,
  pet_id uuid,
  shared_with_user_id uuid,
  permission_level text,
  relationship_type text,
  status text,
  invited_at timestamp with time zone,
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  notes text,
  display_name text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pets WHERE id = p_pet_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ps.id, ps.pet_id, ps.shared_with_user_id, ps.permission_level,
    ps.relationship_type, ps.status, ps.invited_at, ps.accepted_at,
    ps.revoked_at, ps.notes, pr.display_name, pr.email
  FROM public.pet_shares ps
  JOIN public.profiles pr ON pr.id = ps.shared_with_user_id
  WHERE ps.pet_id = p_pet_id
  ORDER BY ps.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pet_share_contacts(uuid) TO authenticated;
