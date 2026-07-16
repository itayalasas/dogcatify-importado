-- Add optional hidden break windows to recurring business schedules.
ALTER TABLE public.business_schedule
  ADD COLUMN IF NOT EXISTS break_start_time text,
  ADD COLUMN IF NOT EXISTS break_end_time text;

COMMENT ON COLUMN public.business_schedule.break_start_time IS
  'Optional hidden break start time inside the recurring schedule.';

COMMENT ON COLUMN public.business_schedule.break_end_time IS
  'Optional hidden break end time inside the recurring schedule.';

-- Store one-off closed dates such as holidays, repairs, anniversaries, or special closures.
CREATE TABLE IF NOT EXISTS public.business_schedule_closures (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  partner_id uuid NOT NULL,
  closed_date date NOT NULL,
  reason text,
  closure_type text NOT NULL DEFAULT 'manual',
  source_year integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT business_schedule_closures_pkey PRIMARY KEY (id),
  CONSTRAINT business_schedule_closures_partner_id_fkey
    FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE CASCADE,
  CONSTRAINT business_schedule_closures_closure_type_check
    CHECK (closure_type = ANY (ARRAY['manual'::text, 'holiday'::text]))
);

CREATE UNIQUE INDEX IF NOT EXISTS business_schedule_closures_partner_id_closed_date_idx
  ON public.business_schedule_closures (partner_id, closed_date);

CREATE INDEX IF NOT EXISTS business_schedule_closures_partner_id_idx
  ON public.business_schedule_closures (partner_id);

CREATE INDEX IF NOT EXISTS business_schedule_closures_closed_date_idx
  ON public.business_schedule_closures (closed_date);

ALTER TABLE public.business_schedule_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view business schedule closures" ON public.business_schedule_closures;
CREATE POLICY "Anyone can view business schedule closures"
  ON public.business_schedule_closures
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Partners can insert their own schedule closures" ON public.business_schedule_closures;
CREATE POLICY "Partners can insert their own schedule closures"
  ON public.business_schedule_closures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.partners
      WHERE partners.id = business_schedule_closures.partner_id
        AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partners can update their own schedule closures" ON public.business_schedule_closures;
CREATE POLICY "Partners can update their own schedule closures"
  ON public.business_schedule_closures
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partners
      WHERE partners.id = business_schedule_closures.partner_id
        AND partners.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.partners
      WHERE partners.id = business_schedule_closures.partner_id
        AND partners.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partners can delete their own schedule closures" ON public.business_schedule_closures;
CREATE POLICY "Partners can delete their own schedule closures"
  ON public.business_schedule_closures
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.partners
      WHERE partners.id = business_schedule_closures.partner_id
        AND partners.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.business_schedule_closures TO anon;
GRANT ALL ON TABLE public.business_schedule_closures TO authenticated;
GRANT ALL ON TABLE public.business_schedule_closures TO service_role;
