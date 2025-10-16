/*
  # Agregar campo updated_at a pet_albums

  1. Cambios
    - Agregar columna `updated_at` (timestamptz) con trigger automático
    - Crear función para actualizar updated_at automáticamente
    - Crear trigger que ejecuta la función en cada UPDATE

  2. Notas
    - El campo se actualiza automáticamente en cada modificación
    - Usa el mismo patrón que otras tablas del sistema
*/

-- Agregar campo updated_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pet_albums' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE pet_albums ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Crear función si no existe
CREATE OR REPLACE FUNCTION update_pet_albums_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS trigger_pet_albums_updated_at ON pet_albums;

-- Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER trigger_pet_albums_updated_at
  BEFORE UPDATE ON pet_albums
  FOR EACH ROW
  EXECUTE FUNCTION update_pet_albums_updated_at();

-- Comentario de documentación
COMMENT ON COLUMN pet_albums.updated_at IS 'Timestamp de última actualización del álbum, se actualiza automáticamente';