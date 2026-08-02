/*
  Sistema CRM de Chatbot Dotty

  1. Nuevas tablas
    - chatbot_conversations
    - chatbot_messages

  2. Seguridad
    - RLS habilitado
    - Politicas publicas para visitantes
    - Politicas para usuarios autenticados
*/

-- Tabla de conversaciones del chatbot
create table if not exists public.chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_name text,
  visitor_email text,
  status text not null default 'bot'
    check (
      status in (
        'bot',
        'waiting_agent',
        'with_agent',
        'resolved',
        'abandoned'
      )
    ),
  assigned_agent_id uuid,
  started_at timestamptz default now(),
  ended_at timestamptz,
  last_message_at timestamptz default now(),
  rating integer
    check (
      rating >= 1
      and rating <= 5
    ),
  metadata jsonb default '{}'::jsonb
);

-- Tabla de mensajes del chatbot
create table if not exists public.chatbot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.chatbot_conversations(id)
    on delete cascade,
  sender_type text not null
    check (
      sender_type in (
        'visitor',
        'bot',
        'agent'
      )
    ),
  sender_id uuid,
  message text not null,
  created_at timestamptz default now(),
  read_at timestamptz,
  metadata jsonb default '{}'::jsonb
);

-- Indices
create index if not exists idx_chatbot_conversations_status
  on public.chatbot_conversations(status);

create index if not exists idx_chatbot_conversations_agent
  on public.chatbot_conversations(assigned_agent_id);

create index if not exists idx_chatbot_conversations_last_message
  on public.chatbot_conversations(last_message_at desc);

create index if not exists idx_chatbot_messages_conversation
  on public.chatbot_messages(conversation_id);

create index if not exists idx_chatbot_messages_created
  on public.chatbot_messages(created_at desc);

-- RLS
alter table public.chatbot_conversations
  enable row level security;

alter table public.chatbot_messages
  enable row level security;

-- Politicas para conversaciones

drop policy if exists
  "Anyone can create chatbot conversations"
on public.chatbot_conversations;

create policy "Anyone can create chatbot conversations"
  on public.chatbot_conversations
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists
  "Anyone can read chatbot conversations"
on public.chatbot_conversations;

create policy "Anyone can read chatbot conversations"
  on public.chatbot_conversations
  for select
  to anon, authenticated
  using (true);

drop policy if exists
  "Authenticated users can update chatbot conversations"
on public.chatbot_conversations;

create policy "Authenticated users can update chatbot conversations"
  on public.chatbot_conversations
  for update
  to authenticated
  using (true)
  with check (true);

-- Politicas para mensajes

drop policy if exists
  "Anyone can insert chatbot messages"
on public.chatbot_messages;

create policy "Anyone can insert chatbot messages"
  on public.chatbot_messages
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists
  "Anyone can read chatbot messages"
on public.chatbot_messages;

create policy "Anyone can read chatbot messages"
  on public.chatbot_messages
  for select
  to anon, authenticated
  using (true);

drop policy if exists
  "Authenticated users can update chatbot messages"
on public.chatbot_messages;

create policy "Authenticated users can update chatbot messages"
  on public.chatbot_messages
  for update
  to authenticated
  using (true)
  with check (true);

-- Funcion para actualizar la ultima actividad
create or replace function public.update_chatbot_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chatbot_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;

  return new;
end;
$$;

-- Trigger
drop trigger if exists
  trigger_update_chatbot_conversation_last_message
on public.chatbot_messages;

create trigger trigger_update_chatbot_conversation_last_message
  after insert
  on public.chatbot_messages
  for each row
  execute function public.update_chatbot_conversation_last_message();