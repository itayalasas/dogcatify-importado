begin;

-- Backfill role flags without downgrading existing users.
-- This keeps any role already present in profiles and only promotes roles
-- when auth metadata or related business records clearly indicate them.
update public.profiles p
set
  is_owner = case
    when p.is_owner is true then true
    when lower(coalesce(u.raw_user_meta_data->>'account_role', '')) = 'owner' then true
    when lower(coalesce(u.raw_user_meta_data->>'is_owner', '')) = 'true' then true
    else p.is_owner
  end,
  is_partner = case
    when p.is_partner is true then true
    when lower(coalesce(u.raw_user_meta_data->>'account_role', '')) = 'partner' then true
    when lower(coalesce(u.raw_user_meta_data->>'is_partner', '')) = 'true' then true
    when exists (
      select 1
      from public.partners pr
      where pr.user_id = p.id
    ) then true
    else p.is_partner
  end,
  is_admin = case
    when p.is_admin is true then true
    when lower(coalesce(u.raw_user_meta_data->>'account_role', '')) = 'admin' then true
    when lower(coalesce(u.raw_user_meta_data->>'is_admin', '')) = 'true' then true
    else p.is_admin
  end,
  updated_at = now()
from auth.users u
where p.id = u.id
  and (
    lower(coalesce(u.raw_user_meta_data->>'account_role', '')) in ('owner', 'partner', 'admin')
    or lower(coalesce(u.raw_user_meta_data->>'is_owner', '')) = 'true'
    or lower(coalesce(u.raw_user_meta_data->>'is_partner', '')) = 'true'
    or lower(coalesce(u.raw_user_meta_data->>'is_admin', '')) = 'true'
    or exists (
      select 1
      from public.partners pr
      where pr.user_id = p.id
    )
  );

commit;
