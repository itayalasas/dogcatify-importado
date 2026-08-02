/*
  # Agregar relaciÃ³n entre servicios y negocios

  1. Cambios
    - Agregar columna `place_id` a la tabla `partner_services` para relacionar servicios con negocios especÃ­ficos
    - Agregar columna `partner_id` a la tabla `places` si no existe para relacionar negocios con partners
    - Agregar claves forÃ¡neas para mantener integridad referencial
    
  2. Seguridad
    - Actualizar polÃ­ticas RLS para permitir a partners gestionar sus negocios y servicios
*/

-- Agregar partner_id a places si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE places ADD COLUMN partner_id uuid REFERENCES partners(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_places_partner_id ON places(partner_id);

  END IF;

END $$;


-- Agregar place_id a partner_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'partner_services' AND column_name = 'place_id'
  ) THEN
    ALTER TABLE partner_services ADD COLUMN place_id uuid REFERENCES places(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_partner_services_place_id ON partner_services(place_id);

  END IF;

END $$;


-- Agregar polÃ­ticas RLS para places si no existen
DO $$
BEGIN
  -- PolÃ­tica para que partners puedan ver sus propios negocios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' AND policyname = 'Partners can view own places'
  ) THEN
    CREATE POLICY "Partners can view own places"
      ON places FOR SELECT
      TO authenticated
      USING (
        partner_id IN (
          SELECT id FROM partners WHERE user_id = auth.uid()
        )
      );

  END IF;


  -- PolÃ­tica para que partners puedan crear negocios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' AND policyname = 'Partners can create own places'
  ) THEN
    CREATE POLICY "Partners can create own places"
      ON places FOR INSERT
      TO authenticated
      WITH CHECK (
        partner_id IN (
          SELECT id FROM partners WHERE user_id = auth.uid()
        )
      );

  END IF;


  -- PolÃ­tica para que partners puedan actualizar sus negocios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' AND policyname = 'Partners can update own places'
  ) THEN
    CREATE POLICY "Partners can update own places"
      ON places FOR UPDATE
      TO authenticated
      USING (
        partner_id IN (
          SELECT id FROM partners WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        partner_id IN (
          SELECT id FROM partners WHERE user_id = auth.uid()
        )
      );

  END IF;


  -- PolÃ­tica para que partners puedan eliminar sus negocios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'places' AND policyname = 'Partners can delete own places'
  ) THEN
    CREATE POLICY "Partners can delete own places"
      ON places FOR DELETE
      TO authenticated
      USING (
        partner_id IN (
          SELECT id FROM partners WHERE user_id = auth.uid()
        )
      );

  END IF;

END $$;
;


