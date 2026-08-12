-- Security hardening: chatbot_conversations/chatbot_messages (the Dotty
-- support-chat CRM, consumed by an external widget with no app login) had
-- "Anyone can read" USING(true) SELECT policies for anon — any caller could
-- dump every visitor's email and full conversation/message history, not
-- just their own. Worse, "Authenticated users can update" USING(true)
-- WITH CHECK(true) let ANY logged-in DogCatiFy app user (not just support
-- staff) edit or reassign any visitor's conversation or message.
--
-- The widget has no auth session for anonymous visitors, so RLS can't scope
-- by auth.uid() the way the rest of this app does. The only thing the
-- widget legitimately possesses is the specific conversation_id it created
-- (an unguessable uuid) — same trust model as a password-reset token. So:
-- direct table SELECT/UPDATE for anon is removed entirely and replaced with
-- SECURITY DEFINER RPCs that take that id as an explicit parameter,
-- returning/touching only that one conversation, never a listing. INSERT
-- stays open (anon posting a new conversation/message can't leak or
-- corrupt anything that already exists). Staff/admin access (browsing and
-- managing all conversations from an external CRM dashboard) is preserved
-- via the same profiles.is_admin check used everywhere else in this app.
--
-- The external widget needs to switch from direct
-- .from('chatbot_conversations'/'chatbot_messages').select()/.update()
-- calls to .rpc('get_chatbot_conversation'/'get_chatbot_messages'/
-- 'update_chatbot_conversation_visitor', {...}).

DROP POLICY IF EXISTS "Anyone can read chatbot conversations" ON public.chatbot_conversations;
DROP POLICY IF EXISTS "Authenticated users can update chatbot conversations" ON public.chatbot_conversations;

CREATE POLICY "Admins can manage all chatbot conversations"
ON public.chatbot_conversations
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Anyone can read chatbot messages" ON public.chatbot_messages;
DROP POLICY IF EXISTS "Authenticated users can update chatbot messages" ON public.chatbot_messages;

CREATE POLICY "Admins can manage all chatbot messages"
ON public.chatbot_messages
FOR ALL
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

-- Fetch a single conversation by its (unguessable) id. No listing/enumeration.
CREATE OR REPLACE FUNCTION public.get_chatbot_conversation(p_conversation_id uuid)
RETURNS TABLE (
  id uuid,
  visitor_name text,
  visitor_email text,
  status text,
  assigned_agent_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  last_message_at timestamptz,
  rating integer,
  metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, visitor_name, visitor_email, status, assigned_agent_id,
         started_at, ended_at, last_message_at, rating, metadata
  FROM public.chatbot_conversations
  WHERE id = p_conversation_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_chatbot_conversation(uuid) TO anon, authenticated;

-- Fetch the message history for a single conversation by its id.
CREATE OR REPLACE FUNCTION public.get_chatbot_messages(p_conversation_id uuid)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_type text,
  sender_id uuid,
  message text,
  created_at timestamptz,
  read_at timestamptz,
  metadata jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, conversation_id, sender_type, sender_id, message, created_at, read_at, metadata
  FROM public.chatbot_messages
  WHERE conversation_id = p_conversation_id
  ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_chatbot_messages(uuid) TO anon, authenticated;

-- Let the visitor themselves close out / rate their own conversation by id.
-- Deliberately narrow: only status (limited to the two visitor-safe end
-- states) and rating — never visitor_email, assigned_agent_id, etc.
CREATE OR REPLACE FUNCTION public.update_chatbot_conversation_visitor(
  p_conversation_id uuid,
  p_status text DEFAULT NULL,
  p_rating integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('resolved', 'abandoned') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
  END IF;

  IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
    RAISE EXCEPTION 'INVALID_RATING' USING ERRCODE = '22023';
  END IF;

  UPDATE public.chatbot_conversations
  SET
    status = COALESCE(p_status, status),
    rating = COALESCE(p_rating, rating),
    ended_at = CASE WHEN p_status IS NOT NULL THEN now() ELSE ended_at END
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_chatbot_conversation_visitor(uuid, text, integer) TO anon, authenticated;
