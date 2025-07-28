/*
  # Sistema de adopciones y chat para refugios

  1. Nuevas Tablas
    - `adoption_pets` - Mascotas disponibles para adopción
    - `chat_conversations` - Conversaciones entre usuarios y refugios
    - `chat_messages` - Mensajes del chat

  2. Seguridad
    - Habilitar RLS en todas las tablas
    - Políticas para usuarios autenticados
    - Políticas específicas para refugios

  3. Funciones
    - Trigger para actualizar last_message_at en conversaciones
*/

-- Tabla de mascotas en adopción
CREATE TABLE IF NOT EXISTS adoption_pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  species text NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
  breed text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  age integer NOT NULL,
  age_unit text NOT NULL DEFAULT 'years' CHECK (age_unit IN ('years', 'months', 'days')),
  size text NOT NULL CHECK (size IN ('small', 'medium', 'large')),
  weight numeric,
  color text,
  description text NOT NULL,
  
  -- Salud
  is_vaccinated boolean DEFAULT false,
  vaccines text[],
  is_dewormed boolean DEFAULT false,
  is_neutered boolean DEFAULT false,
  health_condition text,
  last_vet_visit text,
  
  -- Comportamiento
  temperament text[],
  good_with_dogs boolean,
  good_with_cats boolean,
  good_with_kids boolean,
  energy_level text CHECK (energy_level IN ('low', 'medium', 'high')),
  special_needs text,
  
  -- Adopción
  adoption_requirements text[],
  adoption_fee numeric DEFAULT 0,
  adoption_zones text,
  contact_info text,
  adoption_process text,
  
  -- Media
  images text[],
  
  -- Estado
  is_available boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de conversaciones de chat
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adoption_pet_id uuid REFERENCES adoption_pets(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de mensajes de chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE adoption_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas para adoption_pets
CREATE POLICY "Todos pueden ver mascotas en adopción activas"
  ON adoption_pets
  FOR SELECT
  TO authenticated
  USING (is_available = true);

CREATE POLICY "Solo refugios pueden gestionar sus mascotas"
  ON adoption_pets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = adoption_pets.partner_id 
      AND partners.user_id = auth.uid()
      AND partners.business_type = 'shelter'
    )
  );

-- Políticas para chat_conversations
CREATE POLICY "Usuarios pueden ver sus conversaciones"
  ON chat_conversations
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = chat_conversations.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuarios pueden crear conversaciones"
  ON chat_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Participantes pueden actualizar conversaciones"
  ON chat_conversations
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM partners 
      WHERE partners.id = chat_conversations.partner_id 
      AND partners.user_id = auth.uid()
    )
  );

-- Políticas para chat_messages
CREATE POLICY "Participantes pueden ver mensajes de sus conversaciones"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (
        chat_conversations.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM partners 
          WHERE partners.id = chat_conversations.partner_id 
          AND partners.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Participantes pueden enviar mensajes"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (
        chat_conversations.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM partners 
          WHERE partners.id = chat_conversations.partner_id 
          AND partners.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Participantes pueden marcar mensajes como leídos"
  ON chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations 
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (
        chat_conversations.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM partners 
          WHERE partners.id = chat_conversations.partner_id 
          AND partners.user_id = auth.uid()
        )
      )
    )
  );

-- Función para actualizar last_message_at en conversaciones
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations 
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar last_message_at
DROP TRIGGER IF EXISTS update_conversation_last_message_trigger ON chat_messages;
CREATE TRIGGER update_conversation_last_message_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_adoption_pets_partner_available ON adoption_pets(partner_id, is_available);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_partner ON chat_conversations(partner_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(conversation_id, is_read) WHERE is_read = false;