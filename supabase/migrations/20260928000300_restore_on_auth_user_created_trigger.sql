-- handle_new_user() (redefined across several migrations, most recently
-- 20260718000200_force_custom_email_confirmation.sql) has never had a
-- corresponding trigger on auth.users in any tracked migration in this repo.
-- Without it, a profiles row for a new signup is only ever created lazily,
-- the first time getUserProfile()'s "profile missing" fallback runs during a
-- successful login (lib/supabase.ts / contexts/AuthContext.tsx). But a brand
-- new account can't log in until its email is confirmed, and
-- confirm_email_signup_atomically() (20260808000100) requires an existing
-- profiles row to UPDATE, raising PROFILE_NOT_FOUND when it's missing — so
-- every new signup's confirmation link was doomed to fail with "no pudimos
-- confirmar tu correo". Restoring the trigger so the profile row exists
-- immediately at signup, matching what app/auth/register.tsx has always
-- assumed happens ("Profile will be auto-created by database trigger").
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
