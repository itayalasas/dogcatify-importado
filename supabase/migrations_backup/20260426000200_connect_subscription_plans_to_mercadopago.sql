ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS entitlement_keys jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recommended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mercadopago_monthly_plan_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_yearly_plan_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_monthly_init_point text,
  ADD COLUMN IF NOT EXISTS mercadopago_yearly_init_point text,
  ADD COLUMN IF NOT EXISTS mercadopago_monthly_status text,
  ADD COLUMN IF NOT EXISTS mercadopago_yearly_status text,
  ADD COLUMN IF NOT EXISTS mercadopago_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS mercadopago_sync_error text,
  ADD COLUMN IF NOT EXISTS mercadopago_metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS mercadopago_preapproval_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_preapproval_plan_id text,
  ADD COLUMN IF NOT EXISTS mercadopago_status text,
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_mp_monthly_plan_id
  ON public.subscription_plans (mercadopago_monthly_plan_id)
  WHERE mercadopago_monthly_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_mp_yearly_plan_id
  ON public.subscription_plans (mercadopago_yearly_plan_id)
  WHERE mercadopago_yearly_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_mp_preapproval_id
  ON public.user_subscriptions (mercadopago_preapproval_id)
  WHERE mercadopago_preapproval_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_mp_preapproval_plan_id
  ON public.user_subscriptions (mercadopago_preapproval_plan_id)
  WHERE mercadopago_preapproval_plan_id IS NOT NULL;

UPDATE public.subscription_plans
SET
  tier = CASE
    WHEN lower(name) LIKE '%free%' THEN 'free'
    WHEN lower(name) LIKE '%premium%' OR lower(name) LIKE '%pro%' THEN 'premium'
    ELSE COALESCE(tier, 'standard')
  END,
  label = COALESCE(label, CASE
    WHEN lower(name) LIKE '%free%' THEN 'Por defecto'
    WHEN lower(name) LIKE '%premium%' OR lower(name) LIKE '%pro%' THEN 'Avanzado'
    ELSE 'Intermedio'
  END),
  audience = COALESCE(audience, CASE
    WHEN lower(name) LIKE '%free%' THEN 'Usuarios nuevos y uso esencial'
    WHEN lower(name) LIKE '%premium%' OR lower(name) LIKE '%pro%' THEN 'Usuarios intensivos y multipet'
    ELSE 'Usuarios frecuentes'
  END),
  entitlement_keys = CASE
    WHEN entitlement_keys IS NULL OR jsonb_array_length(entitlement_keys) = 0 THEN
      CASE
        WHEN lower(name) LIKE '%free%' THEN
          '["pet_profiles","shop_services","orders_bookings_history","basic_notifications"]'::jsonb
        WHEN lower(name) LIKE '%premium%' OR lower(name) LIKE '%pro%' THEN
          '["pet_profiles","shop_services","orders_bookings_history","basic_notifications","medical_reminders","appointment_reminders","promo_personalization","priority_support","multi_pet_advanced","advanced_health_reports","medical_history_sharing","early_access"]'::jsonb
        ELSE
          '["pet_profiles","shop_services","orders_bookings_history","basic_notifications","medical_reminders","appointment_reminders","promo_personalization","priority_support"]'::jsonb
      END
    ELSE entitlement_keys
  END,
  is_default = CASE
    WHEN lower(name) LIKE '%free%' THEN true
    ELSE COALESCE(is_default, false)
  END,
  is_recommended = CASE
    WHEN lower(name) LIKE '%standard%' OR lower(name) LIKE '%plus%' THEN true
    ELSE COALESCE(is_recommended, false)
  END
WHERE true;

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
  entitlement_keys,
  is_default,
  is_recommended
)
SELECT
  'Free',
  'Plan base asignado automaticamente a todos los usuarios registrados.',
  0,
  0,
  'UYU',
  '["Perfiles de mascotas","Tienda y servicios","Historial basico","Notificaciones esenciales"]'::jsonb,
  true,
  0,
  'free',
  'Por defecto',
  'Usuarios nuevos y uso esencial',
  '["pet_profiles","shop_services","orders_bookings_history","basic_notifications"]'::jsonb,
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE lower(name) = 'free'
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
  entitlement_keys,
  is_default,
  is_recommended
)
SELECT
  'STANDARD / PLUS',
  'Plan pensado para usuarios activos que necesitan mas herramientas y beneficios.',
  299,
  2990,
  'UYU',
  '["Perfiles de mascotas","Tienda y servicios","Historial basico","Notificaciones esenciales","Recordatorios medicos","Recordatorios de citas","Promociones personalizadas","Soporte prioritario"]'::jsonb,
  true,
  1,
  'standard',
  'Intermedio',
  'Usuarios frecuentes',
  '["pet_profiles","shop_services","orders_bookings_history","basic_notifications","medical_reminders","appointment_reminders","promo_personalization","priority_support"]'::jsonb,
  false,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE lower(name) IN ('standard / plus', 'standard', 'plus')
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
  entitlement_keys,
  is_default,
  is_recommended
)
SELECT
  'PREMIUM / PRO',
  'La experiencia completa para usuarios que quieren gestion avanzada y ventajas superiores.',
  599,
  5990,
  'UYU',
  '["Perfiles de mascotas","Tienda y servicios","Historial basico","Notificaciones esenciales","Recordatorios medicos","Recordatorios de citas","Promociones personalizadas","Soporte prioritario","Gestion multipet avanzada","Reportes de salud","Compartir historial medico","Acceso anticipado"]'::jsonb,
  true,
  2,
  'premium',
  'Avanzado',
  'Usuarios intensivos y multipet',
  '["pet_profiles","shop_services","orders_bookings_history","basic_notifications","medical_reminders","appointment_reminders","promo_personalization","priority_support","multi_pet_advanced","advanced_health_reports","medical_history_sharing","early_access"]'::jsonb,
  false,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE lower(name) IN ('premium / pro', 'premium', 'pro')
);
