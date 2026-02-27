-- Fix reciprocal-like visibility for pet matching and backfill missing matches

DROP POLICY IF EXISTS "pet_swipes_select" ON public.pet_swipes;
CREATE POLICY "pet_swipes_select"
ON public.pet_swipes
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = pet_swipes.to_pet_id
      AND p.owner_id = auth.uid()
  )
);

WITH reciprocal_likes AS (
  SELECT
    LEAST(s1.from_pet_id, s1.to_pet_id) AS pet_a_id,
    GREATEST(s1.from_pet_id, s1.to_pet_id) AS pet_b_id
  FROM public.pet_swipes s1
  JOIN public.pet_swipes s2
    ON s1.from_pet_id = s2.to_pet_id
   AND s1.to_pet_id = s2.from_pet_id
  WHERE s1.action = 'like'
    AND s2.action = 'like'
  GROUP BY 1, 2
),
missing_matches AS (
  SELECT
    r.pet_a_id,
    r.pet_b_id,
    pa.owner_id AS owner_a_id,
    pb.owner_id AS owner_b_id,
    r.pet_a_id::text || '_' || r.pet_b_id::text AS match_key
  FROM reciprocal_likes r
  JOIN public.pets pa ON pa.id = r.pet_a_id
  JOIN public.pets pb ON pb.id = r.pet_b_id
  LEFT JOIN public.pet_matches pm
    ON pm.match_key = r.pet_a_id::text || '_' || r.pet_b_id::text
  WHERE pm.id IS NULL
    AND pa.owner_id <> pb.owner_id
)
INSERT INTO public.pet_matches (
  pet_a_id,
  pet_b_id,
  owner_a_id,
  owner_b_id,
  match_key,
  status,
  matched_at,
  created_at
)
SELECT
  pet_a_id,
  pet_b_id,
  owner_a_id,
  owner_b_id,
  match_key,
  'active',
  now(),
  now()
FROM missing_matches;
