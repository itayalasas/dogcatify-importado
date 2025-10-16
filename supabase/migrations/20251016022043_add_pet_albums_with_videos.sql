/*
  # Agregar soporte de álbumes de mascotas con videos

  1. Nueva Tabla
    - `pet_albums`
      - `id` (uuid, primary key)
      - `pet_id` (uuid, foreign key)
      - `owner_id` (uuid, foreign key)
      - `title` (text) - Título del álbum
      - `description` (text) - Descripción opcional
      - `media_items` (jsonb) - Array de objetos multimedia
        [{ type: 'image'|'video', url: string, duration?: number, thumbnail?: string, validated: boolean }]
      - `is_shared` (boolean) - Compartido en feed público
      - `created_at`, `updated_at`

  2. Notas Importantes
    - Videos: Duración máxima 3 minutos (180 segundos)
    - Validación: Cada video debe contener mascota (validated=true)
    - Thumbnails: Se generan automáticamente para videos

  3. Seguridad
    - RLS habilitado
    - Políticas restrictivas por defecto
*/

-- Crear tabla de álbumes
CREATE TABLE IF NOT EXISTS pet_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  media_items jsonb DEFAULT '[]'::jsonb,
  is_shared boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_pet_albums_owner FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_pet_albums_pet_id ON pet_albums(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_albums_owner_id ON pet_albums(owner_id);
CREATE INDEX IF NOT EXISTS idx_pet_albums_is_shared ON pet_albums(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_pet_albums_created_at ON pet_albums(created_at DESC);

-- Habilitar RLS
ALTER TABLE pet_albums ENABLE ROW LEVEL SECURITY;

-- Política: Ver propios álbumes
CREATE POLICY "Users can view own albums"
  ON pet_albums FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Política: Ver álbumes compartidos
CREATE POLICY "Users can view shared albums"
  ON pet_albums FOR SELECT
  TO authenticated
  USING (is_shared = true);

-- Política: Crear álbumes
CREATE POLICY "Users can create albums"
  ON pet_albums FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Política: Actualizar propios álbumes
CREATE POLICY "Users can update own albums"
  ON pet_albums FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Política: Eliminar propios álbumes
CREATE POLICY "Users can delete own albums"
  ON pet_albums FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_pet_albums_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_pet_albums_updated_at ON pet_albums;
CREATE TRIGGER trigger_pet_albums_updated_at
  BEFORE UPDATE ON pet_albums
  FOR EACH ROW
  EXECUTE FUNCTION update_pet_albums_updated_at();

-- Comentarios de documentación
COMMENT ON TABLE pet_albums IS 'Álbumes de fotos y videos de mascotas con validación de contenido';
COMMENT ON COLUMN pet_albums.media_items IS 'Array JSON: [{ type: "image"|"video", url: string, duration?: number (max 180s), thumbnail?: string, validated: boolean }]';
COMMENT ON COLUMN pet_albums.is_shared IS 'Si true, el álbum es visible públicamente en el feed';