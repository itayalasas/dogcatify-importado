/*
  # Sistema de Compartir Mascotas

  ## Descripción
  Permite a los usuarios compartir sus mascotas con otros usuarios (veterinarios, familia, amigos).
  Los usuarios con acceso compartido pueden ver y gestionar toda la información de la mascota.

  ## 1. Nueva Tabla: pet_shares
  
  Almacena las relaciones de compartir entre mascotas y usuarios.
  
  ### Columnas:
  - `id` (uuid, PK) - Identificador único
  - `pet_id` (uuid, FK) - Referencia a pets
  - `owner_id` (uuid, FK) - Usuario dueño de la mascota
  - `shared_with_user_id` (uuid, FK) - Usuario con quien se comparte
  - `permission_level` (text) - Nivel de permiso: 'view', 'edit', 'admin'
  - `relationship_type` (text) - Tipo de relación: 'veterinarian', 'family', 'friend', 'caretaker', 'other'
  - `status` (text) - Estado: 'pending', 'accepted', 'rejected', 'revoked'
  - `invited_at` (timestamptz) - Fecha de invitación
  - `accepted_at` (timestamptz) - Fecha de aceptación
  - `revoked_at` (timestamptz) - Fecha de revocación
  - `notes` (text) - Notas adicionales
  - `created_at` (timestamptz) - Fecha de creación
  - `updated_at` (timestamptz) - Fecha de actualización

  ## 2. Seguridad (RLS)
  
  ### Políticas de Acceso:
  - Dueños pueden ver/crear/actualizar/eliminar sus compartidos
  - Usuarios compartidos pueden ver sus compartidos
  - Usuarios compartidos pueden aceptar/rechazar invitaciones
  
  ## 3. Índices
  
  - Índice en `pet_id` para búsquedas rápidas
  - Índice en `shared_with_user_id` para listar mascotas compartidas con un usuario
  - Índice compuesto en `pet_id + shared_with_user_id` para verificar duplicados

  ## 4. Notificaciones
  
  - Trigger para notificar cuando se comparte una mascota
  - Trigger para notificar cuando se acepta/rechaza
*/

-- Crear tabla pet_shares
CREATE TABLE IF NOT EXISTS pet_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_level text NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit', 'admin')),
  relationship_type text NOT NULL CHECK (relationship_type IN ('veterinarian', 'family', 'friend', 'caretaker', 'other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'revoked')),
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: No compartir con uno mismo
  CONSTRAINT no_self_share CHECK (owner_id != shared_with_user_id),
  
  -- Constraint: Solo una invitación activa por pet-user
  CONSTRAINT unique_active_share UNIQUE (pet_id, shared_with_user_id)
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_pet_shares_pet_id ON pet_shares(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_shares_shared_with ON pet_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_pet_shares_status ON pet_shares(status);
CREATE INDEX IF NOT EXISTS idx_pet_shares_owner_id ON pet_shares(owner_id);

-- Habilitar RLS
ALTER TABLE pet_shares ENABLE ROW LEVEL SECURITY;

-- Política: Dueños pueden ver todos sus shares
CREATE POLICY "Owners can view their pet shares"
  ON pet_shares
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Política: Usuarios compartidos pueden ver shares donde están incluidos
CREATE POLICY "Shared users can view their shares"
  ON pet_shares
  FOR SELECT
  TO authenticated
  USING (auth.uid() = shared_with_user_id);

-- Política: Dueños pueden crear shares
CREATE POLICY "Owners can create pet shares"
  ON pet_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM pets
      WHERE pets.id = pet_id
      AND pets.owner_id = auth.uid()
    )
  );

-- Política: Dueños pueden actualizar sus shares
CREATE POLICY "Owners can update their pet shares"
  ON pet_shares
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Política: Usuarios compartidos pueden actualizar status (aceptar/rechazar)
CREATE POLICY "Shared users can update share status"
  ON pet_shares
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = shared_with_user_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = shared_with_user_id
    AND status IN ('accepted', 'rejected')
  );

-- Política: Dueños pueden eliminar shares
CREATE POLICY "Owners can delete pet shares"
  ON pet_shares
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_pet_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS set_pet_shares_updated_at ON pet_shares;
CREATE TRIGGER set_pet_shares_updated_at
  BEFORE UPDATE ON pet_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_pet_shares_updated_at();

-- Función para notificar cuando se comparte una mascota
CREATE OR REPLACE FUNCTION notify_pet_share_created()
RETURNS TRIGGER AS $$
DECLARE
  pet_name text;
  owner_name text;
BEGIN
  -- Obtener nombre de la mascota
  SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;
  
  -- Obtener nombre del dueño
  SELECT display_name INTO owner_name FROM profiles WHERE id = NEW.owner_id;
  
  -- Crear notificación programada
  INSERT INTO scheduled_notifications (
    user_id,
    title,
    body,
    data,
    scheduled_for,
    type
  ) VALUES (
    NEW.shared_with_user_id,
    '¡Nueva mascota compartida!',
    owner_name || ' ha compartido a ' || pet_name || ' contigo',
    jsonb_build_object(
      'type', 'pet_share_invitation',
      'petId', NEW.pet_id,
      'shareId', NEW.id,
      'ownerId', NEW.owner_id,
      'relationshipType', NEW.relationship_type
    ),
    now(),
    'pet_share_invitation'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificación de compartir
DROP TRIGGER IF EXISTS on_pet_share_created ON pet_shares;
CREATE TRIGGER on_pet_share_created
  AFTER INSERT ON pet_shares
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_pet_share_created();

-- Función para notificar cuando se acepta una invitación
CREATE OR REPLACE FUNCTION notify_pet_share_accepted()
RETURNS TRIGGER AS $$
DECLARE
  pet_name text;
  shared_user_name text;
BEGIN
  -- Solo notificar si cambió a accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Obtener nombre de la mascota
    SELECT name INTO pet_name FROM pets WHERE id = NEW.pet_id;
    
    -- Obtener nombre del usuario que aceptó
    SELECT display_name INTO shared_user_name FROM profiles WHERE id = NEW.shared_with_user_id;
    
    -- Notificar al dueño
    INSERT INTO scheduled_notifications (
      user_id,
      title,
      body,
      data,
      scheduled_for,
      type
    ) VALUES (
      NEW.owner_id,
      'Invitación aceptada',
      shared_user_name || ' ahora puede ver y gestionar a ' || pet_name,
      jsonb_build_object(
        'type', 'pet_share_accepted',
        'petId', NEW.pet_id,
        'shareId', NEW.id,
        'sharedUserId', NEW.shared_with_user_id
      ),
      now(),
      'pet_share_accepted'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para notificación de aceptación
DROP TRIGGER IF EXISTS on_pet_share_status_changed ON pet_shares;
CREATE TRIGGER on_pet_share_status_changed
  AFTER UPDATE ON pet_shares
  FOR EACH ROW
  EXECUTE FUNCTION notify_pet_share_accepted();

-- Comentarios para documentación
COMMENT ON TABLE pet_shares IS 'Almacena las relaciones de compartir mascotas entre usuarios';
COMMENT ON COLUMN pet_shares.permission_level IS 'Nivel de permiso: view (solo ver), edit (editar), admin (gestión completa)';
COMMENT ON COLUMN pet_shares.relationship_type IS 'Tipo de relación: veterinarian, family, friend, caretaker, other';
COMMENT ON COLUMN pet_shares.status IS 'Estado de la invitación: pending, accepted, rejected, revoked';
