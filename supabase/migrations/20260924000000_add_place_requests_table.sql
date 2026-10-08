-- Feature: allow any authenticated user to propose a new place for "Lugares
-- Pet-Friendly" (either by uploading a photo that AI + Google Places
-- auto-fills, or by filling the form manually). The proposal never writes to
-- `places` directly — it lands in this queue table and only becomes a real
-- `places` row once an admin approves it from app/(admin-tabs)/requests.tsx,
-- mirroring how partner registrations already work today.

CREATE TABLE IF NOT EXISTS public.place_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',

  name text NOT NULL,
  category text NOT NULL,
  address text NOT NULL,
  phone text,
  description text NOT NULL,
  pet_amenities text[] DEFAULT '{}',
  coordinates jsonb,
  rating numeric,

  source_photo_url text,
  images text[],
  google_place_id text,
  ai_raw_response jsonb,

  rejection_reason text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamp with time zone,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT place_requests_submission_method_check CHECK (submission_method IN ('photo_ai', 'manual')),
  CONSTRAINT place_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT place_requests_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

CREATE INDEX IF NOT EXISTS idx_place_requests_status ON public.place_requests (status);
CREATE INDEX IF NOT EXISTS idx_place_requests_requested_by ON public.place_requests (requested_by);

ALTER TABLE public.place_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own place requests"
ON public.place_requests
FOR INSERT
TO authenticated
WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Users can view their own place requests"
ON public.place_requests
FOR SELECT
TO authenticated
USING (requested_by = auth.uid());

CREATE POLICY "Admins can view all place requests"
ON public.place_requests
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update place requests"
ON public.place_requests
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- Traceability: which request (if any) produced a given approved place.
ALTER TABLE public.places
ADD COLUMN IF NOT EXISTS place_request_id uuid REFERENCES public.place_requests(id);
