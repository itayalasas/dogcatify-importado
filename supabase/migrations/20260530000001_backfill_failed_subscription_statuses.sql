-- Backfill subscriptions that were left in an active/trialing state even though Mercado Pago
-- fell back to checkout or returned an error without confirming the subscription.
-- Only rows without a confirmed preapproval and with explicit fallback/error markers are touched.

UPDATE public.user_subscriptions
SET
  status = 'pending',
  started_at = NULL,
  expires_at = NULL,
  mercadopago_status = 'pending',
  crm_subscription_id = NULL,
  mercadopago_preapproval_id = NULL,
  trial_started_at = NULL,
  trial_ends_at = NULL,
  trial_used = false,
  updated_at = NOW()
WHERE status IN ('active', 'trialing')
  AND mercadopago_preapproval_id IS NULL
  AND (
    COALESCE(payment_url, '') ILIKE '%mercadopago.com.uy/subscriptions/checkout%'
    OR COALESCE(metadata, '{}'::jsonb)->>'mp_plan_checkout_fallback' = 'true'
    OR COALESCE(metadata, '{}'::jsonb)->>'mp_preapproval_error' IS NOT NULL
  );

UPDATE public.partner_subscriptions
SET
  status = 'pending',
  started_at = NULL,
  expires_at = NULL,
  mercadopago_status = 'pending',
  crm_subscription_id = NULL,
  mercadopago_preapproval_id = NULL,
  trial_started_at = NULL,
  trial_ends_at = NULL,
  trial_used = false,
  updated_at = NOW()
WHERE status IN ('active', 'trialing')
  AND mercadopago_preapproval_id IS NULL
  AND (
    COALESCE(payment_url, '') ILIKE '%mercadopago.com.uy/subscriptions/checkout%'
    OR COALESCE(metadata, '{}'::jsonb)->>'mp_plan_checkout_fallback' = 'true'
    OR COALESCE(metadata, '{}'::jsonb)->>'mp_preapproval_error' IS NOT NULL
  );

UPDATE public.partners
SET
  subscription_plan_status = 'pending',
  subscription_plan_started_at = NULL,
  subscription_plan_expires_at = NULL,
  updated_at = NOW()
WHERE id IN (
  SELECT ps.partner_id
  FROM public.partner_subscriptions ps
  WHERE ps.status IN ('active', 'trialing')
    AND ps.mercadopago_preapproval_id IS NULL
    AND (
      COALESCE(ps.payment_url, '') ILIKE '%mercadopago.com.uy/subscriptions/checkout%'
      OR COALESCE(ps.metadata, '{}'::jsonb)->>'mp_plan_checkout_fallback' = 'true'
      OR COALESCE(ps.metadata, '{}'::jsonb)->>'mp_preapproval_error' IS NOT NULL
    )
);
