-- Chat between owners after pet match

CREATE TABLE IF NOT EXISTS public.pet_match_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.pet_matches(id) ON DELETE CASCADE,
  owner_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_match_chats_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT pet_match_chats_no_self_check CHECK (owner_a_id <> owner_b_id)
);

CREATE TABLE IF NOT EXISTS public.pet_match_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.pet_match_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_match_chats_owner_a ON public.pet_match_chats(owner_a_id);
CREATE INDEX IF NOT EXISTS idx_pet_match_chats_owner_b ON public.pet_match_chats(owner_b_id);
CREATE INDEX IF NOT EXISTS idx_pet_match_messages_chat ON public.pet_match_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_pet_match_messages_sender ON public.pet_match_messages(sender_id);

DROP TRIGGER IF EXISTS update_pet_match_chats_updated_at ON public.pet_match_chats;
CREATE TRIGGER update_pet_match_chats_updated_at
BEFORE UPDATE ON public.pet_match_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_pet_match_chat_last_message() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.pet_match_chats
  SET
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.chat_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_pet_match_chat_last_message ON public.pet_match_messages;
CREATE TRIGGER trigger_sync_pet_match_chat_last_message
AFTER INSERT ON public.pet_match_messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_pet_match_chat_last_message();

ALTER TABLE public.pet_match_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_match_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pet_match_chats_select" ON public.pet_match_chats;
CREATE POLICY "pet_match_chats_select"
ON public.pet_match_chats
FOR SELECT
TO authenticated
USING (owner_a_id = auth.uid() OR owner_b_id = auth.uid());

DROP POLICY IF EXISTS "pet_match_chats_insert" ON public.pet_match_chats;
CREATE POLICY "pet_match_chats_insert"
ON public.pet_match_chats
FOR INSERT
TO authenticated
WITH CHECK (owner_a_id = auth.uid() OR owner_b_id = auth.uid());

DROP POLICY IF EXISTS "pet_match_chats_update" ON public.pet_match_chats;
CREATE POLICY "pet_match_chats_update"
ON public.pet_match_chats
FOR UPDATE
TO authenticated
USING (owner_a_id = auth.uid() OR owner_b_id = auth.uid())
WITH CHECK (owner_a_id = auth.uid() OR owner_b_id = auth.uid());

DROP POLICY IF EXISTS "pet_match_messages_select" ON public.pet_match_messages;
CREATE POLICY "pet_match_messages_select"
ON public.pet_match_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pet_match_chats c
    WHERE c.id = pet_match_messages.chat_id
      AND (c.owner_a_id = auth.uid() OR c.owner_b_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "pet_match_messages_insert" ON public.pet_match_messages;
CREATE POLICY "pet_match_messages_insert"
ON public.pet_match_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.pet_match_chats c
    WHERE c.id = pet_match_messages.chat_id
      AND (c.owner_a_id = auth.uid() OR c.owner_b_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "pet_match_messages_update" ON public.pet_match_messages;
CREATE POLICY "pet_match_messages_update"
ON public.pet_match_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.pet_match_chats c
    WHERE c.id = pet_match_messages.chat_id
      AND (c.owner_a_id = auth.uid() OR c.owner_b_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.pet_match_chats c
    WHERE c.id = pet_match_messages.chat_id
      AND (c.owner_a_id = auth.uid() OR c.owner_b_id = auth.uid())
  )
);
