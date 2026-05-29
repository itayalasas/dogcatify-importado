ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_used boolean DEFAULT false;

UPDATE public.user_subscriptions
SET
  trial_days = COALESCE(trial_days, 0),
  trial_used = COALESCE(trial_used, false);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_used
  ON public.user_subscriptions (user_id)
  WHERE trial_used = true;

UPDATE public.subscription_plans
SET trial_days = CASE
  WHEN lower(name) LIKE '%free%' THEN 0
  WHEN lower(name) LIKE '%standard%' OR lower(name) LIKE '%plus%' THEN 7
  WHEN lower(name) LIKE '%premium%' OR lower(name) LIKE '%pro%' THEN 14
  ELSE COALESCE(trial_days, 0)
END
WHERE COALESCE(audience_target, 'users') IN ('users', 'all');
