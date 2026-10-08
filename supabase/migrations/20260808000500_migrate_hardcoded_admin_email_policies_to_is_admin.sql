-- Bugfix: 27 RLS policies across 18 tables hardcode the admin identity as
-- `profiles.email = 'admin@dogcatify.com'` (or, in two cases,
-- `auth.jwt()->>'email' = 'admin@dogcatify.com'`) instead of using the
-- profiles.is_admin flag the rest of the app (including the client's own
-- role resolution and the profiles/admin_settings policies fixed in
-- 20260808000200/300) already relies on. Any admin account other than that
-- exact literal email — e.g. a second admin promoted via is_admin = true —
-- silently fails every insert/update/select gated by these policies with
-- 42501 "new row violates row-level security policy" or an empty read,
-- surfaced here via app/(admin-tabs)/settings.tsx's subscription toggle.
--
-- Fix: replace the hardcoded-email check with public.is_admin_user(auth.uid())
-- (the SECURITY DEFINER helper added in 20260808000200) everywhere it
-- appears, preserving every other condition in each policy exactly as-is.

-- accounting_webhook_logs
DROP POLICY IF EXISTS "Solo admins pueden ver logs de contabilidad" ON public.accounting_webhook_logs;
CREATE POLICY "Solo admins pueden ver logs de contabilidad"
ON public.accounting_webhook_logs
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- allergies_catalog
DROP POLICY IF EXISTS "Solo administradores pueden gestionar alergias" ON public.allergies_catalog;
CREATE POLICY "Solo administradores pueden gestionar alergias"
ON public.allergies_catalog
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- crm_webhook_logs
DROP POLICY IF EXISTS "Admins can view crm webhook logs" ON public.crm_webhook_logs;
CREATE POLICY "Admins can view crm webhook logs"
ON public.crm_webhook_logs
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- dewormers_catalog
DROP POLICY IF EXISTS "Solo administradores pueden gestionar desparasitantes" ON public.dewormers_catalog;
CREATE POLICY "Solo administradores pueden gestionar desparasitantes"
ON public.dewormers_catalog
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- deworming_schedules
DROP POLICY IF EXISTS "Only admins can manage deworming schedules" ON public.deworming_schedules;
CREATE POLICY "Only admins can manage deworming schedules"
ON public.deworming_schedules
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- medical_conditions
DROP POLICY IF EXISTS "Solo administradores pueden gestionar condiciones médicas" ON public.medical_conditions;
CREATE POLICY "Solo administradores pueden gestionar condiciones médicas"
ON public.medical_conditions
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- medical_treatments
DROP POLICY IF EXISTS "Solo administradores pueden gestionar tratamientos" ON public.medical_treatments;
CREATE POLICY "Solo administradores pueden gestionar tratamientos"
ON public.medical_treatments
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- partners
DROP POLICY IF EXISTS "Admin can update partner verification status" ON public.partners;
CREATE POLICY "Admin can update partner verification status"
ON public.partners
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can view all partner profiles" ON public.partners;
CREATE POLICY "Admin can view all partner profiles"
ON public.partners
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- places
DROP POLICY IF EXISTS "Only admins can manage places" ON public.places;
CREATE POLICY "Only admins can manage places"
ON public.places
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- promotion_billing
DROP POLICY IF EXISTS "Admin can manage all promotion billing" ON public.promotion_billing;
CREATE POLICY "Admin can manage all promotion billing"
ON public.promotion_billing
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- promotions
DROP POLICY IF EXISTS "Admin can manage all promotions" ON public.promotions;
CREATE POLICY "Admin can manage all promotions"
ON public.promotions
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all promotions" ON public.promotions;
CREATE POLICY "Admins can manage all promotions"
ON public.promotions
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active promotions" ON public.promotions;
CREATE POLICY "Anyone can view active promotions"
ON public.promotions
FOR SELECT
TO authenticated
USING (
  (is_active = true AND start_date <= now() AND end_date >= now())
  OR public.is_admin_user(auth.uid())
  OR (
    partner_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.partners
      WHERE partners.id = promotions.partner_id AND partners.user_id = auth.uid()
    )
  )
);

-- scheduled_notifications
DROP POLICY IF EXISTS "Admin can insert broadcast notifications" ON public.scheduled_notifications;
CREATE POLICY "Admin can insert broadcast notifications"
ON public.scheduled_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_user(auth.uid())
  AND notification_type = 'broadcast'
);

-- subscription_plans
DROP POLICY IF EXISTS "Admin can delete subscription plans" ON public.subscription_plans;
CREATE POLICY "Admin can delete subscription plans"
ON public.subscription_plans
FOR DELETE
TO authenticated
USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can insert subscription plans" ON public.subscription_plans;
CREATE POLICY "Admin can insert subscription plans"
ON public.subscription_plans
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can update subscription plans" ON public.subscription_plans;
CREATE POLICY "Admin can update subscription plans"
ON public.subscription_plans
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can view all subscription plans" ON public.subscription_plans;
CREATE POLICY "Admin can view all subscription plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- subscription_settings (the originally reported error)
DROP POLICY IF EXISTS "Admin can insert subscription settings" ON public.subscription_settings;
CREATE POLICY "Admin can insert subscription settings"
ON public.subscription_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can update subscription settings" ON public.subscription_settings;
CREATE POLICY "Admin can update subscription settings"
ON public.subscription_settings
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- user_subscriptions
DROP POLICY IF EXISTS "Admin can create subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admin can create subscriptions"
ON public.user_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can update subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admin can update subscriptions"
ON public.user_subscriptions
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can view all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admin can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- vaccination_schedules
DROP POLICY IF EXISTS "Only admins can manage vaccination schedules" ON public.vaccination_schedules;
CREATE POLICY "Only admins can manage vaccination schedules"
ON public.vaccination_schedules
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- vaccines_catalog
DROP POLICY IF EXISTS "Solo administradores pueden gestionar vacunas" ON public.vaccines_catalog;
CREATE POLICY "Solo administradores pueden gestionar vacunas"
ON public.vaccines_catalog
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- veterinary_clinics
DROP POLICY IF EXISTS "Solo administradores pueden gestionar clínicas" ON public.veterinary_clinics;
CREATE POLICY "Solo administradores pueden gestionar clínicas"
ON public.veterinary_clinics
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()));
