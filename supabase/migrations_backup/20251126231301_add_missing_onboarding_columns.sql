/*
  Add onboarding columns to profiles

  1. Changes
    - Add onboarding_completed column (boolean, default false)
    - Add onboarding_completed_at column (timestamptz, nullable)

  2. Notes
    - These columns track whether the user has completed the onboarding flow
    - All existing users will have onboarding_completed set to true
*/

alter table public.profiles
  add column if not exists onboarding_completed boolean default false not null;

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set
  onboarding_completed = true,
  onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed = false;