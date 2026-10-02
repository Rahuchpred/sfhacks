-- Round 5: messages. Three kinds of conversation, all text only:
--   question      one student with the team of one event, private
--   announcement  the team of an event to everyone registered for it, write-once
--   help          the requester and the student of an accepted (or done) help offer
-- Rows are written only through the functions below. Who may read is decided by
-- conversation_side(), which the select policies and Realtime both use.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('question', 'announcement', 'help')),
  event_id uuid references public.events (id) on delete cascade,
  student_id uuid references auth.users (id) on delete cascade,
  help_offer_id uuid references public.help_offers (id) on delete cascade,
  closed_at timestamptz,
  -- Which side closed it: only that side may reopen it.
  closed_side text check (closed_side in ('student', 'team', 'helper', 'requester')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'question' and event_id is not null and student_id is not null and help_offer_id is null)
    or (kind = 'announcement' and event_id is not null and student_id is null and help_offer_id is null)
    or (kind = 'help' and help_offer_id is not null and event_id is null and student_id is null)
  )
);

create unique index conversations_question_idx on public.conversations (event_id, student_id)
  where kind = 'question';
create unique index conversations_announcement_idx on public.conversations (event_id)
  where kind = 'announcement';
create unique index conversations_help_idx on public.conversations (help_offer_id)
  where kind = 'help';
create index conversations_student_idx on public.conversations (student_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

-- When each person last opened a conversation, for the unread dot.
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  uid uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, uid)
);

-- The caller's side of a conversation, or null when it is not theirs to see.
--   question:      'student' (who asked) or 'team' (anyone who manages the event)
--   announcement:  'team', or 'audience' for everyone registered right now
--   help:          'helper' (the student) or 'requester', while the offer is accepted or done
create function public.conversation_side(p_conversation_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_conv public.conversations;
  v_helper uuid;
  v_requester uuid;
  v_status text;
begin
  if v_uid is null then
    return null;
  end if;
  select * into v_conv from public.conversations c where c.id = p_conversation_id;
  if not found then
    return null;
  end if;

  if v_conv.kind = 'help' then
    select o.uid, q.created_by, o.status into v_helper, v_requester, v_status
      from public.help_offers o
      join public.help_requests q on q.id = o.request_id
      where o.id = v_conv.help_offer_id;
    if not found or v_status not in ('accepted', 'done') then
      return null;
    end if;
    if v_helper = v_uid then
      return 'helper';
    end if;
    if v_requester = v_uid then
      return 'requester';
    end if;
    return null;
  end if;

  if v_conv.kind = 'question' and v_conv.student_id = v_uid then
    return 'student';
  end if;
  if public.can_manage_event(v_conv.event_id) then
    return 'team';
  end if;
  if v_conv.kind = 'announcement' and exists (
    select 1 from public.rsvps r where r.event_id = v_conv.event_id and r.uid = v_uid
  ) then
    return 'audience';
  end if;
  return null;
end;
$$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;

-- Read only. Every write goes through a function, so there are no other policies.
create policy "people read their conversations" on public.conversations
  for select to authenticated using (public.conversation_side(id) is not null);
create policy "people read messages in their conversations" on public.messages
  for select to authenticated using (public.conversation_side(conversation_id) is not null);
create policy "people read their own read marks" on public.conversation_reads
  for select to authenticated using (uid = (select auth.uid()));

revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.messages from anon, authenticated;
revoke insert, update, delete on public.conversation_reads from anon, authenticated;

-- What the caller may do with messages on one event. One call serves the
-- "Ask the host" button, the announce button and the announcements list.
create function public.event_messaging(p_event_id uuid)
returns table (has_host boolean, is_team boolean, registered boolean, audience integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.created_by is not null or e.club_id is not null,
    public.can_manage_event(e.id),
    exists (select 1 from public.rsvps r where r.event_id = e.id and r.uid = auth.uid()),
    -- The number of people an announcement reaches, for the team only.
    case when public.can_manage_event(e.id)
      then (select count(*)::integer from public.rsvps r where r.event_id = e.id)
    end
  from public.events e
  where e.id = p_event_id;
$$;

-- Opens the caller's private conversation with an event's team, creating it on
-- the first call. Guests and the event's own team cannot ask.
create function public.open_event_conversation(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_id uuid;
begin
  if v_uid is null or public.my_role() is null then
    raise exception 'not_signed_in';
  end if;
  select * into v_event from public.events e where e.id = p_event_id;
  if not found then
    raise exception 'not_found';
  end if;
  if v_event.created_by is null and v_event.club_id is null then
    raise exception 'no_host';
  end if;
  if public.can_manage_event(p_event_id) then
    raise exception 'is_team';
  end if;

  insert into public.conversations (kind, event_id, student_id)
    values ('question', p_event_id, v_uid)
    on conflict (event_id, student_id) where kind = 'question' do nothing;
  select c.id into v_id from public.conversations c
    where c.kind = 'question' and c.event_id = p_event_id and c.student_id = v_uid;
  return v_id;
end;
$$;

-- Opens the conversation of a help offer, for the requester or the student,
-- once the offer is accepted or done.
create function public.open_help_conversation(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if not exists (
    select 1 from public.help_offers o
      join public.help_requests q on q.id = o.request_id
      where o.id = p_offer_id
        and o.status in ('accepted', 'done')
        and (o.uid = v_uid or q.created_by = v_uid)
  ) then
    raise exception 'not_allowed';
  end if;

  insert into public.conversations (kind, help_offer_id)
    values ('help', p_offer_id)
    on conflict (help_offer_id) where kind = 'help' do nothing;
  select c.id into v_id from public.conversations c
    where c.kind = 'help' and c.help_offer_id = p_offer_id;
  return v_id;
end;
$$;

-- Sends one message. Refuses outsiders, closed conversations, students writing
-- in an announcement thread, more than 10 messages a minute from one sender,
-- and more than 5 announcements for one event in 10 minutes.
create function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_side text := public.conversation_side(p_conversation_id);
  v_conv public.conversations;
  v_recent integer;
  v_message public.messages;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if v_side is null or v_side = 'audience' then
    raise exception 'not_allowed';
  end if;
  if length(v_body) = 0 then
    raise exception 'empty';
  end if;
  if length(v_body) > 1000 then
    raise exception 'too_long';
  end if;

  select * into v_conv from public.conversations c where c.id = p_conversation_id for update;
  if v_conv.closed_at is not null then
    raise exception 'closed';
  end if;

  select count(*) into v_recent from public.messages m
    where m.sender_id = v_uid and m.created_at > now() - interval '1 minute';
  if v_recent >= 10 then
    raise exception 'rate_limited';
  end if;
  if v_conv.kind = 'announcement' then
    select count(*) into v_recent from public.messages m
      where m.conversation_id = p_conversation_id and m.created_at > now() - interval '10 minutes';
    if v_recent >= 5 then
      raise exception 'rate_limited';
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body)
    values (p_conversation_id, v_uid, v_body)
    returning * into v_message;
  update public.conversations c set last_message_at = v_message.created_at
    where c.id = p_conversation_id;
  -- The sender has read their own message.
  insert into public.conversation_reads (conversation_id, uid, last_read_at)
    values (p_conversation_id, v_uid, v_message.created_at)
    on conflict (conversation_id, uid) do update set last_read_at = excluded.last_read_at;
  return v_message;
end;
$$;

-- The event's team sends one message to everyone registered, now or later.
create function public.send_announcement(p_event_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if not public.can_manage_event(p_event_id) then
    raise exception 'not_allowed';
  end if;
  insert into public.conversations (kind, event_id)
    values ('announcement', p_event_id)
    on conflict (event_id) where kind = 'announcement' do nothing;
  select c.id into v_id from public.conversations c
    where c.kind = 'announcement' and c.event_id = p_event_id;
  return public.send_message(v_id, p_body);
end;
$$;

-- Either side closes a private conversation. Only the side that closed it reopens it.
create function public.set_conversation_closed(p_conversation_id uuid, p_closed boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_side text := public.conversation_side(p_conversation_id);
  v_conv public.conversations;
begin
  if v_side is null or v_side not in ('student', 'team', 'helper', 'requester') then
    raise exception 'not_allowed';
  end if;
  select * into v_conv from public.conversations c where c.id = p_conversation_id for update;
  if v_conv.kind = 'announcement' then
    raise exception 'not_allowed';
  end if;

  if p_closed then
    if v_conv.closed_at is null then
      update public.conversations c set closed_at = now(), closed_side = v_side
        where c.id = p_conversation_id;
    end if;
    return true;
  end if;

  if v_conv.closed_at is not null and v_conv.closed_side <> v_side then
    raise exception 'not_allowed';
  end if;
  update public.conversations c set closed_at = null, closed_side = null
    where c.id = p_conversation_id;
  return true;
end;
$$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.conversation_side(p_conversation_id) is null then
    return;
  end if;
  insert into public.conversation_reads (conversation_id, uid, last_read_at)
    values (p_conversation_id, auth.uid(), now())
    on conflict (conversation_id, uid) do update set last_read_at = excluded.last_read_at;
end;
$$;

-- The inbox: every conversation of the caller that has a message, newest first.
-- With an id it returns that one conversation, even when it is still empty.
-- Names only, never an email. A student sees the club's name, not a member's.
create function public.my_conversations(p_conversation_id uuid default null)
returns table (
  conversation_id uuid,
  kind text,
  side text,
  event_id uuid,
  help_request_id uuid,
  title text,
  counterpart text,
  last_body text,
  last_at timestamptz,
  last_mine boolean,
  unread boolean,
  closed boolean,
  can_reopen boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select c.*, public.conversation_side(c.id) as side
    from public.conversations c
    where (p_conversation_id is null and c.last_message_at is not null)
       or c.id = p_conversation_id
  )
  select
    m.id,
    m.kind,
    m.side,
    m.event_id,
    q.id,
    coalesce(e.title, q.title, ''),
    case
      when m.side in ('student', 'audience') then coalesce(nullif(e.club_name, ''), 'Host')
      when m.kind = 'announcement' then 'Everyone registered'
      when m.side = 'team' then coalesce(nullif(sp.full_name, ''), 'Student')
      when m.side = 'helper' then coalesce(nullif(q.requester_name, ''), 'Faculty')
      else coalesce(nullif(hp.full_name, ''), 'Student')
    end,
    lm.body,
    lm.created_at,
    coalesce(lm.sender_id = auth.uid(), false),
    coalesce(lm.sender_id <> auth.uid() and lm.created_at > coalesce(r.last_read_at, '-infinity'), false),
    m.closed_at is not null,
    m.closed_at is not null and m.closed_side = m.side,
    m.created_at
  from mine m
  left join public.events e on e.id = m.event_id
  left join public.help_offers o on o.id = m.help_offer_id
  left join public.help_requests q on q.id = o.request_id
  left join public.profiles sp on sp.id = m.student_id
  left join public.profiles hp on hp.id = o.uid
  left join public.conversation_reads r on r.conversation_id = m.id and r.uid = auth.uid()
  left join lateral (
    select x.id, x.body, x.sender_id, x.created_at
    from public.messages x
    where x.conversation_id = m.id
    order by x.created_at desc
    limit 1
  ) lm on true
  where m.side is not null
  order by coalesce(lm.created_at, m.created_at) desc;
$$;

-- One thread, oldest first, with a name for each sender. The team reads the
-- student's name and each other's. A student reads the club's name only.
create function public.conversation_messages(p_conversation_id uuid)
returns table (message_id uuid, sender_name text, mine boolean, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with conv as (
    select c.*, public.conversation_side(c.id) as side
    from public.conversations c
    where c.id = p_conversation_id
  ),
  latest as (
    select x.*
    from public.messages x
    where x.conversation_id = p_conversation_id
    order by x.created_at desc
    limit 300
  )
  select
    x.id,
    case
      when v.kind = 'help' and x.sender_id = o.uid then coalesce(nullif(p.full_name, ''), 'Student')
      when v.kind = 'help' then coalesce(nullif(q.requester_name, ''), nullif(p.full_name, ''), 'Faculty')
      when x.sender_id = v.student_id then coalesce(nullif(p.full_name, ''), 'Student')
      when v.side = 'team' then coalesce(nullif(p.full_name, ''), 'Host')
      else coalesce(nullif(e.club_name, ''), 'Host')
    end,
    x.sender_id = auth.uid(),
    x.body,
    x.created_at
  from conv v
  join latest x on true
  left join public.events e on e.id = v.event_id
  left join public.help_offers o on o.id = v.help_offer_id
  left join public.help_requests q on q.id = o.request_id
  left join public.profiles p on p.id = x.sender_id
  where v.side is not null
  order by x.created_at;
$$;

-- An event's announcements, for its team and for everyone registered.
create function public.event_announcements(p_event_id uuid)
returns table (message_id uuid, conversation_id uuid, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, c.id, x.body, x.created_at
  from public.conversations c
  join public.messages x on x.conversation_id = c.id
  where c.kind = 'announcement'
    and c.event_id = p_event_id
    and public.conversation_side(c.id) is not null
  order by x.created_at desc;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'conversation_side(uuid)', 'event_messaging(uuid)', 'open_event_conversation(uuid)',
    'open_help_conversation(uuid)', 'send_message(uuid, text)', 'send_announcement(uuid, text)',
    'set_conversation_closed(uuid, boolean)', 'mark_conversation_read(uuid)',
    'my_conversations(uuid)', 'conversation_messages(uuid)', 'event_announcements(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;

alter publication supabase_realtime add table public.conversations, public.messages;
