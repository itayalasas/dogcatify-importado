ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS limits jsonb DEFAULT '{}'::jsonb;

UPDATE public.subscription_plans
SET limits = COALESCE(limits, '{}'::jsonb);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_plans_limits_is_object_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_limits_is_object_check
      CHECK (limits IS NULL OR jsonb_typeof(limits) = 'object');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_limits
  ON public.subscription_plans USING gin (limits);

UPDATE public.subscription_plans
SET limits = CASE
  WHEN lower(COALESCE(tier, name)) IN ('free', 'starter') THEN
    jsonb_build_object(
      'users', jsonb_build_object(
        'max_pets', 2,
        'max_posts_per_day', 3,
        'max_pet_albums', 2,
        'max_match_swipes_per_day', 1,
        'dotty_enabled', false
      )
    )
  WHEN lower(COALESCE(tier, name)) IN ('standard', 'growth', 'plus') THEN
    jsonb_build_object(
      'users', jsonb_build_object(
        'max_pets', 5,
        'max_posts_per_day', 10,
        'max_pet_albums', 5,
        'max_match_swipes_per_day', 5,
        'dotty_enabled', true
      )
    )
  WHEN lower(COALESCE(tier, name)) IN ('premium', 'pro') THEN
    jsonb_build_object(
      'users', jsonb_build_object(
        'max_pets', NULL,
        'max_posts_per_day', NULL,
        'max_pet_albums', NULL,
        'max_match_swipes_per_day', NULL,
        'dotty_enabled', true
      )
    )
  ELSE limits
END
WHERE (limits IS NULL OR limits = '{}'::jsonb)
  AND COALESCE(audience_target, 'users') IN ('users', 'all');

UPDATE public.subscription_plans
SET limits = CASE
  WHEN lower(COALESCE(tier, name)) IN ('free', 'starter') THEN
    jsonb_build_object(
      'partners', jsonb_build_object(
        'max_businesses', 1,
        'max_services', 5,
        'max_products', 10,
        'max_promotions', 1
      )
    )
  WHEN lower(COALESCE(tier, name)) IN ('standard', 'growth', 'plus') THEN
    jsonb_build_object(
      'partners', jsonb_build_object(
        'max_businesses', 3,
        'max_services', 20,
        'max_products', 40,
        'max_promotions', 3
      )
    )
  WHEN lower(COALESCE(tier, name)) IN ('premium', 'pro') THEN
    jsonb_build_object(
      'partners', jsonb_build_object(
        'max_businesses', NULL,
        'max_services', NULL,
        'max_products', NULL,
        'max_promotions', NULL
      )
    )
  ELSE limits
END
WHERE (limits IS NULL OR limits = '{}'::jsonb)
  AND COALESCE(audience_target, 'users') = 'partners';

UPDATE public.subscription_plans
SET limits = CASE
  WHEN lower(COALESCE(tier, name)) IN ('free', 'starter') THEN
    jsonb_build_object(
      'users', jsonb_build_object(
        'max_pets', 2,
        'max_posts_per_day', 3,
        'max_pet_albums', 2,
        'max_match_swipes_per_day', 1,
        'dotty_enabled', false
      ),
      'partners', jsonb_build_object(
        'max_businesses', 1,
        'max_services', 5,
        'max_products', 10,
        'max_promotions', 1
      )
    )
  WHEN lower(COALESCE(tier, name)) IN ('standard', 'growth', 'plus') THEN
    jsonb_build_object(
      'users', jsonb_build_object(
        'max_pets', 5,
        'max_posts_per_day', 10,
        'max_pet_albums', 5,
        'max_match_swipes_per_day', 5,
        'dotty_enabled', true
      ),
      'partners', jsonb_build_object(
        'max_businesses', 3,
        'max_services', 20,
        'max_products', 40,
        'max_promotions', 3
      )
    )
  WHEN lower(COALESCE(tier, name)) IN ('premium', 'pro') THEN
    jsonb_build_object(
      'users', jsonb_build_object(
        'max_pets', NULL,
        'max_posts_per_day', NULL,
        'max_pet_albums', NULL,
        'max_match_swipes_per_day', NULL,
        'dotty_enabled', true
      ),
      'partners', jsonb_build_object(
        'max_businesses', NULL,
        'max_services', NULL,
        'max_products', NULL,
        'max_promotions', NULL
      )
    )
  ELSE limits
END
WHERE (limits IS NULL OR limits = '{}'::jsonb)
  AND COALESCE(audience_target, 'users') = 'all';
