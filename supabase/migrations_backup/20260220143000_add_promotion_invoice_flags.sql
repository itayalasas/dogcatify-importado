ALTER TABLE public.promotions
ADD COLUMN IF NOT EXISTS views_invoiced boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS clicks_invoiced boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS views_invoiced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS clicks_invoiced_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_promotions_views_invoiced
ON public.promotions (views_invoiced);

CREATE INDEX IF NOT EXISTS idx_promotions_clicks_invoiced
ON public.promotions (clicks_invoiced);
