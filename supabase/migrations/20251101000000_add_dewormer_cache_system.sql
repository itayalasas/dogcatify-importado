/*
  # Sistema de Caché para Recomendaciones de Desparasitantes con IA

  1. Nueva Tabla
    - `dewormers_ai_cache`
      - `id` (uuid, primary key)
      - `species` (text, dog/cat)
      - `breed` (text, raza de la mascota)
      - `age_in_months` (integer, edad en meses)
      - `weight` (numeric, peso en kg)
      - `recommendations` (jsonb, recomendaciones de IA)
      - `created_at` (timestamp)
      - `expires_at` (timestamp, caché válido por 90 días)

  2. Seguridad
    - Enable RLS en `dewormers_ai_cache`
    - Políticas para que usuarios autenticados puedan leer el caché
    - Solo el sistema puede escribir en el caché

  3. Índices
    - Índice compuesto en (species, breed, age_in_months, weight) para búsquedas rápidas
    - Índice en expires_at para limpieza automática

  4. Funciones
    - Trigger para limpiar caché expirado automáticamente
*/

CREATE TABLE IF NOT EXISTS dewormers_ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL CHECK (species IN ('dog', 'cat')),
  breed text,
  age_in_months integer,
  weight numeric(5,2),
  recommendations jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);

ALTER TABLE dewormers_ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden leer caché de desparasitantes"
  ON dewormers_ai_cache
  FOR SELECT
  TO authenticated
  USING (expires_at > now());

CREATE POLICY "Solo el sistema puede insertar en caché de desparasitantes"
  ON dewormers_ai_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_dewormers_cache_lookup
  ON dewormers_ai_cache(species, breed, age_in_months, weight)
  WHERE expires_at > now();

CREATE INDEX IF NOT EXISTS idx_dewormers_cache_expires
  ON dewormers_ai_cache(expires_at);

CREATE OR REPLACE FUNCTION cleanup_expired_dewormer_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM dewormers_ai_cache
  WHERE expires_at < now() - interval '7 days';
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    RAISE NOTICE 'pg_cron extension not available, skipping scheduled cleanup';
  ELSE
    PERFORM cron.schedule(
      'cleanup-expired-dewormer-cache',
      '0 2 * * *',
      $$SELECT cleanup_expired_dewormer_cache()$$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cleanup job: %', SQLERRM;
END $$;
