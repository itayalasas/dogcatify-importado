-- One-shot fix para error: APPROVAL_SCHEMA_MISSING
-- Ejecutar en Supabase SQL Editor (proyecto hpvzjuionqvgxlvhyqgz)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.promotions
ADD COLUMN IF NOT EXISTS cost_per_like numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_view numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_click numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS approval_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approval_decision_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approval_decision_reason text;

ALTER TABLE public.promotions
DROP CONSTRAINT IF EXISTS promotions_approval_status_check;

ALTER TABLE public.promotions
ADD CONSTRAINT promotions_approval_status_check
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE public.promotions
DROP CONSTRAINT IF EXISTS promotions_cost_per_like_check;

ALTER TABLE public.promotions
ADD CONSTRAINT promotions_cost_per_like_check
CHECK (cost_per_like IS NULL OR cost_per_like >= 0);

ALTER TABLE public.promotions
DROP CONSTRAINT IF EXISTS promotions_cost_per_view_check;

ALTER TABLE public.promotions
ADD CONSTRAINT promotions_cost_per_view_check
CHECK (cost_per_view IS NULL OR cost_per_view >= 0);

ALTER TABLE public.promotions
DROP CONSTRAINT IF EXISTS promotions_cost_per_click_check;

ALTER TABLE public.promotions
ADD CONSTRAINT promotions_cost_per_click_check
CHECK (cost_per_click IS NULL OR cost_per_click >= 0);

CREATE INDEX IF NOT EXISTS idx_promotions_approval_status
ON public.promotions (approval_status);

CREATE TABLE IF NOT EXISTS public.promotion_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  partner_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  token_hash text NOT NULL UNIQUE,
  action_token_expires_at timestamp with time zone NOT NULL,
  requested_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid REFERENCES public.profiles(id),
  acted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT promotion_approval_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_promotion_approval_requests_promotion
ON public.promotion_approval_requests (promotion_id);

CREATE INDEX IF NOT EXISTS idx_promotion_approval_requests_status
ON public.promotion_approval_requests (status);

-- Verificación rápida
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'promotions'
      AND column_name = 'approval_requested_at'
  ) AS promotions_has_approval_requested_at,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'promotion_approval_requests'
  ) AS approval_requests_table_exists;
