-- Set iva_included_in_price to true for all partners that have NULL
-- This assumes that in Uruguay, most prices include IVA by default
UPDATE partners
SET iva_included_in_price = true
WHERE iva_included_in_price IS NULL;

-- Verify the update
SELECT 
  id, 
  business_name, 
  iva_rate, 
  iva_included_in_price,
  CASE 
    WHEN iva_included_in_price = true THEN '✅ IVA Included'
    WHEN iva_included_in_price = false THEN '⚠️  IVA NOT Included (will add to price)'
    ELSE '❌ NULL (should not happen after update)'
  END as status
FROM partners
ORDER BY business_name
LIMIT 20;
