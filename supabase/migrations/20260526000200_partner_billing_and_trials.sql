ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS audience_target text DEFAULT 'users',
  ADD COLUMN IF NOT EXISTS trial_days integer DEFAULT 0;

UPDATE public.subscription_plans
SET
  audience_target = COALESCE(NULLIF(audience_target, ''), 'users'),
  trial_days = COALESCE(trial_days, 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_plans_audience_target_check'
  ) THEN
    ALTER TABLE public.subscription_plans
      ADD CONSTRAINT subscription_plans_audience_target_check
      CHECK (audience_target IN ('users', 'partners', 'all'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_audience_target
  ON public.subscription_plans (audience_target);

CREATE TABLE IF NOT EXISTS public.partner_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  partner_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  billing_cycle text,
  crm_subscription_id text,
  started_at timestamptz,
  expires_at timestamptz,
  trial_days integer DEFAULT 0,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_used boolean DEFAULT false,
  canceled_at timestamptz,
  cancellation_reason text,
  mercadopago_preapproval_id text,
  mercadopago_preapproval_plan_id text,
  mercadopago_status text,
  payment_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT partner_subscriptions_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'yearly')),
  CONSTRAINT partner_subscriptions_status_check CHECK (
    status IN ('pending', 'trialing', 'active', 'paused', 'cancelled', 'expired', 'past_due')
  )
);

ALTER TABLE public.partner_subscriptions OWNER TO postgres;

ALTER TABLE public.partner_subscriptions
  ADD CONSTRAINT partner_subscriptions_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES public.partners(id)
  ON DELETE CASCADE;

ALTER TABLE public.partner_subscriptions
  ADD CONSTRAINT partner_subscriptions_plan_id_fkey
  FOREIGN KEY (plan_id)
  REFERENCES public.subscription_plans(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_partner_id
  ON public.partner_subscriptions (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_status
  ON public.partner_subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_plan_id
  ON public.partner_subscriptions (plan_id);

CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_mp_preapproval_id
  ON public.partner_subscriptions (mercadopago_preapproval_id)
  WHERE mercadopago_preapproval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_mp_preapproval_plan_id
  ON public.partner_subscriptions (mercadopago_preapproval_plan_id)
  WHERE mercadopago_preapproval_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_subscriptions_trial_used
  ON public.partner_subscriptions (partner_id)
  WHERE trial_used = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_subscriptions_current
  ON public.partner_subscriptions (partner_id)
  WHERE status IN ('pending', 'trialing', 'active', 'paused');

CREATE TRIGGER update_partner_subscriptions_updated_at
  BEFORE UPDATE ON public.partner_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.partner_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all partner subscriptions"
  ON public.partner_subscriptions
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can view all partner subscriptions"
  ON public.partner_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Partners can view own partner subscriptions"
  ON public.partner_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    partner_id IN (
      SELECT partners.id
      FROM public.partners
      WHERE partners.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.partner_subscriptions TO anon;
GRANT ALL ON TABLE public.partner_subscriptions TO authenticated;
GRANT ALL ON TABLE public.partner_subscriptions TO service_role;

INSERT INTO public.subscription_plans (
  name,
  description,
  price_monthly,
  price_yearly,
  currency,
  features,
  is_active,
  sort_order,
  tier,
  label,
  audience,
  audience_target,
  trial_days,
  entitlement_keys,
  is_default,
  is_recommended
)
SELECT
  'Starter',
  'Plan base para aliados que necesitan operar agenda, servicios, productos y cobros sin complejidad extra.',
  0,
  0,
  'UYU',
  '["Dashboard operativo","Agenda y reservas","Gestion de servicios y productos","Pedidos y cobros con Mercado Pago","Edicion basica del negocio"]'::jsonb,
  true,
  0,
  'starter',
  'Base',
  'Aliados operativos',
  'partners',
  0,
  '[]'::jsonb,
  false,
  false
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans
  WHERE lower(name) = 'starter'
    AND COALESCE(audience_target, 'users') = 'partners'
);

INSERT INTO public.subscription_plans (
  name,
  description,
  price_monthly,
  price_yearly,
  currency,
  features,
  is_active,
  sort_order,
  tier,
  label,
  audience,
  audience_target,
  trial_days,
  entitlement_keys,
  is_default,
  is_recommended
)
SELECT
  'Growth',
  'Plan de crecimiento para aliados que necesitan clientes, analitica operativa y mejor control comercial.',
  1490,
  14900,
  'UYU',
  '["Todo lo del plan Starter","Historial y segmento de clientes","Inteligencia de negocio basica","Analiticas de demanda y actividad","Mejor soporte operativo"]'::jsonb,
  true,
  1,
  'growth',
  'Crecimiento',
  'Aliados en expansión',
  'partners',
  7,
  '[]'::jsonb,
  false,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans
  WHERE lower(name) = 'growth'
    AND COALESCE(audience_target, 'users') = 'partners'
);

INSERT INTO public.subscription_plans (
  name,
  description,
  price_monthly,
  price_yearly,
  currency,
  features,
  is_active,
  sort_order,
  tier,
  label,
  audience,
  audience_target,
  trial_days,
  entitlement_keys,
  is_default,
  is_recommended
)
SELECT
  'Pro',
  'Plan completo para aliados con analitica avanzada, adopciones y soporte prioritario.',
  2990,
  29900,
  'UYU',
  '["Todo lo del plan Growth","Gestion de contactos de adopcion","Insights avanzados y localizacion","Prioridad en soporte","Configuracion comercial completa"]'::jsonb,
  true,
  2,
  'pro',
  'Avanzado',
  'Aliados avanzados',
  'partners',
  14,
  '[]'::jsonb,
  false,
  false
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans
  WHERE lower(name) = 'pro'
    AND COALESCE(audience_target, 'users') = 'partners'
);
