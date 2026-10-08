-- A product sold in several presentations (e.g. the same dog food in 1 kg,
-- 2 kg and 10 kg, each with its own price and stock) is stored as one
-- partner_products row per presentation, linked by a shared variant_group_id.
-- Keeping every presentation a real row means carts, orders and the
-- stock-decrement/restore triggers (keyed by product id) work unchanged.
ALTER TABLE public.partner_products
  ADD COLUMN IF NOT EXISTS variant_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_partner_products_variant_group
  ON public.partner_products (variant_group_id)
  WHERE variant_group_id IS NOT NULL;
