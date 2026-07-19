/*
  Update handle_new_user to include onboarding fields

  1. Changes
    - Sets onboarding_completed to false for new users
    - Ensures new users see the onboarding flow

  2. Security
    - Maintains SECURITY DEFINER to bypass RLS
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
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
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    true,
    false,
    new.email_confirmed_at is not null,
    new.email_confirmed_at,
    false,
    array[]::text[],
    array[]::text[],
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;