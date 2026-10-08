-- get_pet_share_contacts declares `RETURNS TABLE (id uuid, ...)`, which makes
-- `id` an OUT parameter/plpgsql variable in scope for the whole function
-- body. The ownership check below referenced the pets table's own `id`
-- column unqualified ("WHERE id = p_pet_id"), which Postgres can no longer
-- resolve unambiguously between that OUT parameter and pets.id — raising
-- 42702 "column reference id is ambiguous" on every call, i.e. every time
-- app/pets/share-pet.tsx opens.

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
    SELECT 1 FROM public.pets p WHERE p.id = p_pet_id AND p.owner_id = auth.uid()
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
