/*
  Script de migración para el sistema de confirmación de emails

  Este script debe ejecutarse DESPUÉS de haber aplicado la migración principal
  (20251015143942_create_complete_database_structure.sql)

  Instrucciones:
  1. Abrir el dashboard de Supabase
  2. Ir a SQL Editor
  3. Copiar y pegar este script completo
  4. Ejecutar
*/

-- ============================================================================
-- PARTE 1: Agregar campos faltantes a la tabla profiles
-- ============================================================================

DO $$
BEGIN
  -- Agregar email_confirmed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'email_confirmed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email_confirmed boolean DEFAULT false;
    RAISE NOTICE 'Campo email_confirmed agregado a profiles';
  ELSE
    RAISE NOTICE 'Campo email_confirmed ya existe en profiles';
  END IF;

  -- Agregar email_confirmed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'email_confirmed_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email_confirmed_at timestamptz;
    RAISE NOTICE 'Campo email_confirmed_at agregado a profiles';
  ELSE
    RAISE NOTICE 'Campo email_confirmed_at ya existe en profiles';
  END IF;

  -- Agregar is_owner
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'is_owner'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_owner boolean DEFAULT true;
    RAISE NOTICE 'Campo is_owner agregado a profiles';
  ELSE
    RAISE NOTICE 'Campo is_owner ya existe en profiles';
  END IF;

  -- Agregar is_partner
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_partner boolean DEFAULT false;
    RAISE NOTICE 'Campo is_partner agregado a profiles';
  ELSE
    RAISE NOTICE 'Campo is_partner ya existe en profiles';
  END IF;

  -- Agregar followers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'followers'
  ) THEN
    ALTER TABLE profiles ADD COLUMN followers uuid[] DEFAULT '{}';
    RAISE NOTICE 'Campo followers agregado a profiles';
  ELSE
    RAISE NOTICE 'Campo followers ya existe en profiles';
  END IF;

  -- Agregar following
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'following'
  ) THEN
    ALTER TABLE profiles ADD COLUMN following uuid[] DEFAULT '{}';
    RAISE NOTICE 'Campo following agregado a profiles';
  ELSE
    RAISE NOTICE 'Campo following ya existe en profiles';
  END IF;
END $$;

-- ============================================================================
-- PARTE 2: Crear tabla email_confirmations
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('signup', 'password_reset')),
  is_confirmed boolean DEFAULT false,
  confirmed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PARTE 3: Crear índices para mejor rendimiento
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_email_confirmations_user_id
  ON email_confirmations(user_id);

CREATE INDEX IF NOT EXISTS idx_email_confirmations_token_hash
  ON email_confirmations(token_hash);

CREATE INDEX IF NOT EXISTS idx_email_confirmations_type
  ON email_confirmations(type);

CREATE INDEX IF NOT EXISTS idx_email_confirmations_is_confirmed
  ON email_confirmations(is_confirmed);

-- ============================================================================
-- PARTE 4: Habilitar Row Level Security (RLS)
-- ============================================================================

ALTER TABLE email_confirmations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 5: Crear políticas de seguridad
-- ============================================================================

-- Política para service role (para operaciones del sistema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_confirmations'
    AND policyname = 'Service role can manage email confirmations'
  ) THEN
    CREATE POLICY "Service role can manage email confirmations"
      ON email_confirmations FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
    RAISE NOTICE 'Política creada: Service role can manage email confirmations';
  ELSE
    RAISE NOTICE 'Política ya existe: Service role can manage email confirmations';
  END IF;
END $$;

-- ============================================================================
-- PARTE 6: Crear función para limpiar tokens expirados
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_email_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM email_confirmations
  WHERE expires_at < now() AND is_confirmed = false;

  RAISE NOTICE 'Tokens expirados eliminados';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTE 7: Agregar comentarios para documentación
-- ============================================================================

COMMENT ON TABLE email_confirmations IS
  'Tokens de confirmación de email personalizados para registro y recuperación de contraseña';

COMMENT ON COLUMN email_confirmations.user_id IS
  'Usuario asociado al token';

COMMENT ON COLUMN email_confirmations.token_hash IS
  'Token único de confirmación';

COMMENT ON COLUMN email_confirmations.type IS
  'Tipo de confirmación: signup o password_reset';

COMMENT ON COLUMN email_confirmations.is_confirmed IS
  'Indica si el token ya fue usado';

COMMENT ON COLUMN email_confirmations.expires_at IS
  'Fecha de expiración del token (24 horas)';

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
  email_confirmations_exists boolean;
  profiles_has_email_confirmed boolean;
BEGIN
  -- Verificar que la tabla email_confirmations existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'email_confirmations'
  ) INTO email_confirmations_exists;

  -- Verificar que profiles tiene el campo email_confirmed
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'email_confirmed'
  ) INTO profiles_has_email_confirmed;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICACIÓN DE MIGRACIÓN';
  RAISE NOTICE '========================================';

  IF email_confirmations_exists THEN
    RAISE NOTICE '✓ Tabla email_confirmations: CREADA';
  ELSE
    RAISE NOTICE '✗ Tabla email_confirmations: NO EXISTE';
  END IF;

  IF profiles_has_email_confirmed THEN
    RAISE NOTICE '✓ Campo email_confirmed en profiles: CREADO';
  ELSE
    RAISE NOTICE '✗ Campo email_confirmed en profiles: NO EXISTE';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migración completada exitosamente';
  RAISE NOTICE '========================================';
END $$;
