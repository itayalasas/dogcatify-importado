-- app/partner/business-insights.tsx used to pull latitud/longitud/barrio/
-- department_id for EVERY user with a pet directly into the client (no
-- filter at all) to compute "nearby pets" analytics for any partner. Even
-- though the UI only ever rendered aggregated counts, the raw per-user GPS
-- coordinates were present in the network response for anyone who inspected
-- it. This RPC does the same aggregation server-side and returns only
-- counts/histograms — no per-user identity or coordinates ever leave the
-- database.

CREATE OR REPLACE FUNCTION public.get_nearby_pets_for_partner(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_lat double precision;
  v_partner_lon double precision;
  v_partner_barrio text;
  v_partner_department_id uuid;
  v_has_coordinates boolean;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.partners
    WHERE id = p_partner_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT
    NULLIF(latitud, '')::double precision,
    NULLIF(longitud, '')::double precision,
    barrio,
    department_id
  INTO v_partner_lat, v_partner_lon, v_partner_barrio, v_partner_department_id
  FROM public.partners
  WHERE id = p_partner_id;

  v_has_coordinates := v_partner_lat IS NOT NULL AND v_partner_lon IS NOT NULL;

  IF NOT v_has_coordinates THEN
    RETURN jsonb_build_object('hasCoordinates', false);
  END IF;

  WITH user_pets AS (
    SELECT
      pr.id AS user_id,
      pr.barrio,
      pr.department_id,
      NULLIF(pr.latitud, '')::double precision AS lat,
      NULLIF(pr.longitud, '')::double precision AS lon,
      p.id AS pet_id,
      p.species,
      p.age,
      p.breed
    FROM public.profiles pr
    JOIN public.pets p ON p.owner_id = pr.id
  ),
  distances AS (
    SELECT
      *,
      CASE
        WHEN lat IS NOT NULL AND lon IS NOT NULL THEN
          6371 * 2 * asin(sqrt(
            sin(radians(lat - v_partner_lat) / 2) ^ 2 +
            cos(radians(v_partner_lat)) * cos(radians(lat)) *
            sin(radians(lon - v_partner_lon) / 2) ^ 2
          ))
        ELSE NULL
      END AS distance_km
    FROM user_pets
  ),
  breed_counts AS (
    SELECT breed, count(*) AS cnt
    FROM distances
    WHERE distance_km IS NOT NULL AND distance_km <= 10 AND breed IS NOT NULL
    GROUP BY breed
    ORDER BY cnt DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'hasCoordinates', true,
    'nearbyPets', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 5), 0),
    'sameNeighborhood', COALESCE((
      SELECT count(*) FROM distances
      WHERE v_partner_barrio IS NOT NULL AND barrio IS NOT NULL
        AND lower(barrio) = lower(v_partner_barrio)
    ), 0),
    'sameDepartment', COALESCE((
      SELECT count(*) FROM distances
      WHERE v_partner_department_id IS NOT NULL AND department_id = v_partner_department_id
    ), 0),
    'withinRadius', jsonb_build_object(
      '5km', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 5), 0),
      '10km', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10), 0),
      '20km', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 20), 0)
    ),
    'petsBySpecies', jsonb_build_object(
      'dogs', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10 AND species = 'dog'), 0),
      'cats', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10 AND species = 'cat'), 0),
      'others', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10 AND species NOT IN ('dog', 'cat')), 0)
    ),
    'petsByAge', jsonb_build_object(
      'puppies', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10 AND COALESCE(age, 0) <= 1), 0),
      'young', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10 AND COALESCE(age, 0) > 1 AND COALESCE(age, 0) <= 3), 0),
      'adult', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10 AND COALESCE(age, 0) > 3 AND COALESCE(age, 0) <= 7), 0),
      'senior', COALESCE((SELECT count(*) FROM distances WHERE distance_km <= 10 AND COALESCE(age, 0) > 7), 0)
    ),
    'topNearbyBreeds', COALESCE((SELECT jsonb_agg(jsonb_build_object('breed', breed, 'count', cnt)) FROM breed_counts), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_pets_for_partner(uuid) TO authenticated;
