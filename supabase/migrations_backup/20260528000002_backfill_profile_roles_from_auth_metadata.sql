-- Backfill role flags for existing profiles using auth.users metadata.
-- This corrects accounts that were created as owner even though they registered as partner.

UPDATE public.profiles AS p
SET
  is_owner = CASE
    WHEN LOWER(COALESCE(u.raw_user_meta_data->>'account_role', 'owner')) = 'partner' THEN FALSE
    WHEN LOWER(COALESCE(u.raw_user_meta_data->>'account_role', 'owner')) = 'owner' THEN TRUE
    ELSE COALESCE((u.raw_user_meta_data->>'is_owner')::boolean, p.is_owner, TRUE)
  END,
  is_partner = CASE
    WHEN LOWER(COALESCE(u.raw_user_meta_data->>'account_role', 'owner')) = 'partner' THEN TRUE
    WHEN LOWER(COALESCE(u.raw_user_meta_data->>'account_role', 'owner')) = 'owner' THEN FALSE
    ELSE COALESCE((u.raw_user_meta_data->>'is_partner')::boolean, p.is_partner, FALSE)
  END,
  updated_at = NOW()
FROM auth.users AS u
WHERE u.id = p.id
  AND (
    LOWER(COALESCE(u.raw_user_meta_data->>'account_role', '')) IN ('owner', 'partner')
    OR u.raw_user_meta_data ? 'is_owner'
    OR u.raw_user_meta_data ? 'is_partner'
  );
