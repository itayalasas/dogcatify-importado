/*
  # Sistema de caché para alergias con IA

  1. Nueva Tabla
    - `allergies_ai_cache`
      - `id` (uuid, primary key)
      - `species` (text) - Especie de la mascota
      - `breed` (text) - Raza específica
      - `age_in_months` (integer) - Edad en meses
      - `weight` (numeric, optional) - Peso para considerar predisposiciones
      - `allergies` (jsonb) - Array de alergias con detalles
      - `cache_key` (text, unique) - Clave única para búsqueda rápida
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz) - Caché válido por 90 días

  2. Seguridad
    - Habilitar RLS en la tabla
    - Políticas para usuarios autenticados

  3. Índices
    - Índices en campos de búsqueda comunes para mejor performance
    - Índice en expires_at para limpieza de caché

  4. Funciones
    - Actualizar función de limpieza automática de caché expirado
*/

-- Crear tabla de caché de alergias
CREATE TABLE IF NOT EXISTS allergies_ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL CHECK (species IN ('dog', 'cat')),
  breed text NOT NULL,
  age_in_months integer NOT NULL CHECK (age_in_months >= 0),
  weight numeric CHECK (weight > 0),
  allergies jsonb NOT NULL DEFAULT '[]'::jsonb,
  cache_key text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);

-- Habilitar RLS
ALTER TABLE allergies_ai_cache ENABLE ROW LEVEL SECURITY;

-- Políticas para allergies_ai_cache
CREATE POLICY "Usuarios autenticados pueden leer caché de alergias"
  ON allergies_ai_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar en caché de alergias"
  ON allergies_ai_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Índices para allergies_ai_cache
CREATE INDEX IF NOT EXISTS idx_allergies_cache_key ON allergies_ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_allergies_species_breed ON allergies_ai_cache(species, breed);
CREATE INDEX IF NOT EXISTS idx_allergies_expires_at ON allergies_ai_cache(expires_at);

-- Actualizar función para limpiar caché expirado de alergias
CREATE OR REPLACE FUNCTION cleanup_expired_allergy_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM allergies_ai_cache
  WHERE expires_at < now();
END;
$$;

-- Actualizar función existente para incluir limpieza de alergias
CREATE OR REPLACE FUNCTION cleanup_expired_illness_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM illnesses_ai_cache
  WHERE expires_at < now();

  DELETE FROM treatments_ai_cache
  WHERE expires_at < now();

  DELETE FROM allergies_ai_cache
  WHERE expires_at < now();
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE allergies_ai_cache IS 'Caché de recomendaciones de alergias generadas por IA basadas en especie, raza y edad';
COMMENT ON COLUMN allergies_ai_cache.cache_key IS 'Formato: {species}_{breed}_{age}_{weight}';
COMMENT ON COLUMN allergies_ai_cache.allergies IS 'Array JSON de alergias con estructura: [{name, description, allergy_type, symptoms, severity, frequency, triggers, prevention_tips}]';
