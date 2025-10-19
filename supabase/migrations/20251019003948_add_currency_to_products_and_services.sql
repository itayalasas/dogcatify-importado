/*
  # Agregar soporte de moneda a productos y servicios

  1. Cambios
    - Agregar campo `currency` a tabla `partner_products`
    - Agregar campo `currency` a tabla `partner_services`
    - Agregar campo `currency_code_dgi` a ambas tablas para código numérico DGI
    - Valores por defecto: currency = 'UYU', currency_code_dgi = '858' (Peso Uruguayo)

  2. Códigos de moneda DGI Uruguay
    - UYU: 858 (Peso Uruguayo)
    - USD: 840 (Dólar Estadounidense)
    - EUR: 978 (Euro)

  3. Notas
    - Los campos tienen valores por defecto para compatibilidad con datos existentes
    - El código DGI es el estándar ISO 4217 usado por la DGI Uruguay
*/

-- Agregar campos de moneda a partner_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_products' AND column_name = 'currency'
  ) THEN
    ALTER TABLE partner_products ADD COLUMN currency text DEFAULT 'UYU' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_products' AND column_name = 'currency_code_dgi'
  ) THEN
    ALTER TABLE partner_products ADD COLUMN currency_code_dgi text DEFAULT '858' NOT NULL;
  END IF;
END $$;

-- Agregar campos de moneda a partner_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'currency'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN currency text DEFAULT 'UYU' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'currency_code_dgi'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN currency_code_dgi text DEFAULT '858' NOT NULL;
  END IF;
END $$;

-- Agregar comentarios para documentación
COMMENT ON COLUMN partner_products.currency IS 'Código de moneda ISO 4217 (UYU, USD, EUR)';
COMMENT ON COLUMN partner_products.currency_code_dgi IS 'Código numérico de moneda según DGI Uruguay (858=UYU, 840=USD, 978=EUR)';
COMMENT ON COLUMN partner_services.currency IS 'Código de moneda ISO 4217 (UYU, USD, EUR)';
COMMENT ON COLUMN partner_services.currency_code_dgi IS 'Código numérico de moneda según DGI Uruguay (858=UYU, 840=USD, 978=EUR)';

-- Crear índices para mejorar búsquedas por moneda
CREATE INDEX IF NOT EXISTS idx_partner_products_currency ON partner_products(currency);
CREATE INDEX IF NOT EXISTS idx_partner_services_currency ON partner_services(currency);
