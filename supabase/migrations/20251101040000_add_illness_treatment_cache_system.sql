/*
  # Sistema de caché para enfermedades y tratamientos con IA

  1. Nuevas Tablas
    - `illnesses_ai_cache`
      - `id` (uuid, primary key)
      - `species` (text) - Especie de la mascota
      - `breed` (text) - Raza específica
      - `age_in_months` (integer) - Edad en meses
      - `weight` (numeric, optional) - Peso para considerar predisposiciones
      - `illnesses` (jsonb) - Array de enfermedades con detalles
      - `cache_key` (text, unique) - Clave única para búsqueda rápida
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz) - Caché válido por 90 días

    - `treatments_ai_cache`
      - `id` (uuid, primary key)
      - `species` (text) - Especie de la mascota
      - `illness_name` (text) - Nombre de la enfermedad
      - `age_in_months` (integer) - Edad para dosificación
      - `weight` (numeric, optional) - Peso para dosificación
      - `treatments` (jsonb) - Array de tratamientos recomendados
      - `cache_key` (text, unique) - Clave única para búsqueda rápida
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz) - Caché válido por 90 días

  2. Seguridad
    - Habilitar RLS en ambas tablas
    - Políticas para usuarios autenticados

  3. Índices
    - Índices en campos de búsqueda comunes para mejor performance
    - Índice en expires_at para limpieza de caché

  4. Funciones
    - Función de limpieza automática de caché expirado
*/

-- Crear tabla de caché de enfermedades
CREATE TABLE IF NOT EXISTS illnesses_ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL CHECK (species IN ('dog', 'cat')),
  breed text NOT NULL,
  age_in_months integer NOT NULL CHECK (age_in_months >= 0),
  weight numeric CHECK (weight > 0),
  illnesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  cache_key text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);

-- Crear tabla de caché de tratamientos
CREATE TABLE IF NOT EXISTS treatments_ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL CHECK (species IN ('dog', 'cat')),
  illness_name text NOT NULL,
  age_in_months integer NOT NULL CHECK (age_in_months >= 0),
  weight numeric CHECK (weight > 0),
  treatments jsonb NOT NULL DEFAULT '[]'::jsonb,
  cache_key text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days')
);

-- Habilitar RLS
ALTER TABLE illnesses_ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments_ai_cache ENABLE ROW LEVEL SECURITY;

-- Políticas para illnesses_ai_cache
CREATE POLICY "Usuarios autenticados pueden leer caché de enfermedades"
  ON illnesses_ai_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar en caché de enfermedades"
  ON illnesses_ai_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para treatments_ai_cache
CREATE POLICY "Usuarios autenticados pueden leer caché de tratamientos"
  ON treatments_ai_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar en caché de tratamientos"
  ON treatments_ai_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Índices para illnesses_ai_cache
CREATE INDEX IF NOT EXISTS idx_illnesses_cache_key ON illnesses_ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_illnesses_species_breed ON illnesses_ai_cache(species, breed);
CREATE INDEX IF NOT EXISTS idx_illnesses_expires_at ON illnesses_ai_cache(expires_at);

-- Índices para treatments_ai_cache
CREATE INDEX IF NOT EXISTS idx_treatments_cache_key ON treatments_ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_treatments_species_illness ON treatments_ai_cache(species, illness_name);
CREATE INDEX IF NOT EXISTS idx_treatments_expires_at ON treatments_ai_cache(expires_at);

-- Función para limpiar caché expirado de enfermedades
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
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE illnesses_ai_cache IS 'Caché de recomendaciones de enfermedades generadas por IA basadas en especie, raza y edad';
COMMENT ON TABLE treatments_ai_cache IS 'Caché de recomendaciones de tratamientos generados por IA basados en enfermedad, especie y características de la mascota';
COMMENT ON COLUMN illnesses_ai_cache.cache_key IS 'Formato: {species}_{breed}_{age}_{weight}';
COMMENT ON COLUMN treatments_ai_cache.cache_key IS 'Formato: {species}_{illness}_{age}_{weight}';
COMMENT ON COLUMN illnesses_ai_cache.illnesses IS 'Array JSON de enfermedades con estructura: [{name, description, category, symptoms, severity, is_contagious, affected_systems}]';
COMMENT ON COLUMN treatments_ai_cache.treatments IS 'Array JSON de tratamientos con estructura: [{name, description, type, requires_prescription, dosage, duration, side_effects}]';
