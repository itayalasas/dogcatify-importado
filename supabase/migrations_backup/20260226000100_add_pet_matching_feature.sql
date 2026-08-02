-- Pet Matching MVP (Tinder-style for pets)

CREATE TABLE IF NOT EXISTS public.pet_mating_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL UNIQUE REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  bio text,
  preferred_max_distance_km integer NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_mating_profiles_distance_check CHECK (preferred_max_distance_km >= 1 AND preferred_max_distance_km <= 200)
);

CREATE TABLE IF NOT EXISTS public.pet_swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  to_pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_swipes_action_check CHECK (action IN ('like', 'pass')),
  CONSTRAINT pet_swipes_no_self_check CHECK (from_pet_id <> to_pet_id),
  CONSTRAINT pet_swipes_unique_pair UNIQUE (from_pet_id, to_pet_id)
);

CREATE TABLE IF NOT EXISTS public.pet_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_a_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  pet_b_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  matched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_matches_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT pet_matches_no_self_check CHECK (pet_a_id <> pet_b_id)
);

CREATE INDEX IF NOT EXISTS idx_pet_mating_profiles_active ON public.pet_mating_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_pet_mating_profiles_owner ON public.pet_mating_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_pet_swipes_from_pet ON public.pet_swipes(from_pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_swipes_to_pet ON public.pet_swipes(to_pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_matches_pet_a ON public.pet_matches(pet_a_id);
CREATE INDEX IF NOT EXISTS idx_pet_matches_pet_b ON public.pet_matches(pet_b_id);
CREATE INDEX IF NOT EXISTS idx_pet_matches_owner_a ON public.pet_matches(owner_a_id);
CREATE INDEX IF NOT EXISTS idx_pet_matches_owner_b ON public.pet_matches(owner_b_id);

DROP TRIGGER IF EXISTS update_pet_mating_profiles_updated_at ON public.pet_mating_profiles;
CREATE TRIGGER update_pet_mating_profiles_updated_at
BEFORE UPDATE ON public.pet_mating_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pet_mating_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pet_mating_profiles_select" ON public.pet_mating_profiles;
CREATE POLICY "pet_mating_profiles_select"
ON public.pet_mating_profiles
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR is_active = true
);

DROP POLICY IF EXISTS "pet_mating_profiles_insert" ON public.pet_mating_profiles;
CREATE POLICY "pet_mating_profiles_insert"
ON public.pet_mating_profiles
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pet_mating_profiles_update" ON public.pet_mating_profiles;
CREATE POLICY "pet_mating_profiles_update"
ON public.pet_mating_profiles
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pet_mating_profiles_delete" ON public.pet_mating_profiles;
CREATE POLICY "pet_mating_profiles_delete"
ON public.pet_mating_profiles
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "pet_swipes_select" ON public.pet_swipes;
CREATE POLICY "pet_swipes_select"
ON public.pet_swipes
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "pet_swipes_insert" ON public.pet_swipes;
CREATE POLICY "pet_swipes_insert"
ON public.pet_swipes
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pet_swipes_update" ON public.pet_swipes;
CREATE POLICY "pet_swipes_update"
ON public.pet_swipes
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pet_swipes_delete" ON public.pet_swipes;
CREATE POLICY "pet_swipes_delete"
ON public.pet_swipes
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "pet_matches_select" ON public.pet_matches;
CREATE POLICY "pet_matches_select"
ON public.pet_matches
FOR SELECT
TO authenticated
USING (
  owner_a_id = auth.uid()
  OR owner_b_id = auth.uid()
);

DROP POLICY IF EXISTS "pet_matches_insert" ON public.pet_matches;
CREATE POLICY "pet_matches_insert"
ON public.pet_matches
FOR INSERT
TO authenticated
WITH CHECK (
  owner_a_id = auth.uid()
  OR owner_b_id = auth.uid()
);

DROP POLICY IF EXISTS "pet_matches_update" ON public.pet_matches;
CREATE POLICY "pet_matches_update"
ON public.pet_matches
FOR UPDATE
TO authenticated
USING (
  owner_a_id = auth.uid()
  OR owner_b_id = auth.uid()
)
WITH CHECK (
  owner_a_id = auth.uid()
  OR owner_b_id = auth.uid()
);
