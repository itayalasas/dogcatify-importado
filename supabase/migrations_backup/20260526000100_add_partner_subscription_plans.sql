ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS subscription_plan_tier text DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_plan_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_plan_started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_plan_metadata jsonb DEFAULT '{}'::jsonb;

UPDATE public.partners
SET
  subscription_plan_tier = COALESCE(NULLIF(subscription_plan_tier, ''), 'starter'),
  subscription_plan_status = COALESCE(
    NULLIF(subscription_plan_status, ''),
    CASE
      WHEN is_verified = true THEN 'active'
      ELSE 'pending'
    END
  ),
  subscription_plan_started_at = COALESCE(subscription_plan_started_at, created_at, now()),
  subscription_plan_metadata = COALESCE(subscription_plan_metadata, '{}'::jsonb)
WHERE true;

CREATE INDEX IF NOT EXISTS idx_partners_subscription_plan_tier
  ON public.partners (subscription_plan_tier);

CREATE INDEX IF NOT EXISTS idx_partners_subscription_plan_status
  ON public.partners (subscription_plan_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'partners_subscription_plan_tier_check'
      AND conrelid = 'public.partners'::regclass
  ) THEN
    ALTER TABLE public.partners
      ADD CONSTRAINT partners_subscription_plan_tier_check
      CHECK (subscription_plan_tier IN ('starter', 'growth', 'pro'));
  END IF;
END $$;
