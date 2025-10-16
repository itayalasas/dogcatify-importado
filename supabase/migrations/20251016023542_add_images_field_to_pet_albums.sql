/*
  # Agregar campo images a pet_albums

  1. Cambios
    - Agregar columna `images` (text array) para almacenar URLs de fotos y videos
    - Mantener `media_items` para compatibilidad futura
    - Campo `images` almacena URLs con prefijo "VIDEO:" para videos

  2. Notas
    - Videos se identifican con prefijo "VIDEO:" en la URL
    - Ejemplo: ["https://.../foto.jpg", "VIDEO:https://.../video.mp4"]
*/

-- Agregar campo images si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pet_albums' AND column_name = 'images'
  ) THEN
    ALTER TABLE pet_albums ADD COLUMN images text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Crear índice para búsquedas en el array
CREATE INDEX IF NOT EXISTS idx_pet_albums_images ON pet_albums USING GIN(images);

-- Comentario de documentación
COMMENT ON COLUMN pet_albums.images IS 'Array de URLs de imágenes y videos. Videos tienen prefijo "VIDEO:" (ej: "VIDEO:https://.../video.mp4")';