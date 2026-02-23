-- Agrega umbral de envío gratis por negocio (tienda)
-- Seguro de ejecutar múltiples veces

ALTER TABLE public.partners
ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric DEFAULT 0;

COMMENT ON COLUMN public.partners.free_shipping_threshold IS
'Importe mínimo de compra para habilitar envío gratis en tiendas. 0 = sin umbral.';

-- Opcional: normalizar valores nulos a 0
UPDATE public.partners
SET free_shipping_threshold = 0
WHERE free_shipping_threshold IS NULL;
