-- Delivery profiles: allow users to register as couriers and associate one or more stores

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_delivery boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.delivery_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('single_store', 'multi_store')),
  approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_profile_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_profile_id uuid NOT NULL REFERENCES public.delivery_profiles(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_profile_id, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_profiles_user_id
  ON public.delivery_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_delivery_profile_stores_profile
  ON public.delivery_profile_stores(delivery_profile_id);

CREATE INDEX IF NOT EXISTS idx_delivery_profile_stores_partner
  ON public.delivery_profile_stores(partner_id);

ALTER TABLE public.delivery_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_profile_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_profiles_select_own" ON public.delivery_profiles;
CREATE POLICY "delivery_profiles_select_own"
ON public.delivery_profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "delivery_profiles_insert_own" ON public.delivery_profiles;
CREATE POLICY "delivery_profiles_insert_own"
ON public.delivery_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delivery_profiles_update_own" ON public.delivery_profiles;
CREATE POLICY "delivery_profiles_update_own"
ON public.delivery_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delivery_profile_stores_select_own" ON public.delivery_profile_stores;
CREATE POLICY "delivery_profile_stores_select_own"
ON public.delivery_profile_stores
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    WHERE dp.id = delivery_profile_stores.delivery_profile_id
      AND dp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delivery_profile_stores_insert_own" ON public.delivery_profile_stores;
CREATE POLICY "delivery_profile_stores_insert_own"
ON public.delivery_profile_stores
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    WHERE dp.id = delivery_profile_stores.delivery_profile_id
      AND dp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delivery_profile_stores_delete_own" ON public.delivery_profile_stores;
CREATE POLICY "delivery_profile_stores_delete_own"
ON public.delivery_profile_stores
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    WHERE dp.id = delivery_profile_stores.delivery_profile_id
      AND dp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delivery_profile_stores_update_own" ON public.delivery_profile_stores;
CREATE POLICY "delivery_profile_stores_update_own"
ON public.delivery_profile_stores
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    WHERE dp.id = delivery_profile_stores.delivery_profile_id
      AND dp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.delivery_profiles dp
    WHERE dp.id = delivery_profile_stores.delivery_profile_id
      AND dp.user_id = auth.uid()
  )
);
