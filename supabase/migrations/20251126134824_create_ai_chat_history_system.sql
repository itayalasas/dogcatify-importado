/*
  # Create AI Chat History System

  1. New Tables
    - `ai_chat_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz, nullable)
      - `message_count` (integer)
    
    - `ai_chat_messages`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to ai_chat_sessions)
      - `user_id` (uuid, foreign key to profiles)
      - `role` (text, 'user' or 'assistant')
      - `content` (text)
      - `audio_used` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own chat history
    - Users can insert their own messages
*/

-- Create ai_chat_sessions table
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create ai_chat_messages table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  audio_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_started_at ON ai_chat_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_created_at ON ai_chat_messages(created_at DESC);

-- Enable RLS
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own chat sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON ai_chat_sessions;
DROP POLICY IF EXISTS "Users can view own chat messages" ON ai_chat_messages;
DROP POLICY IF EXISTS "Users can insert own chat messages" ON ai_chat_messages;

-- RLS Policies for ai_chat_sessions
CREATE POLICY "Users can view own chat sessions"
  ON ai_chat_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat sessions"
  ON ai_chat_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat sessions"
  ON ai_chat_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ai_chat_messages
CREATE POLICY "Users can view own chat messages"
  ON ai_chat_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON ai_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to update message count
CREATE OR REPLACE FUNCTION update_session_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_chat_sessions
  SET message_count = message_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update message count
DROP TRIGGER IF EXISTS trigger_update_session_message_count ON ai_chat_messages;
CREATE TRIGGER trigger_update_session_message_count
  AFTER INSERT ON ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_message_count();