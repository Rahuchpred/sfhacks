-- Round 3: clubs with organizers, food tied to hosted events, claim holds with
-- pickup codes, and attendance data for organizer analytics.

-- Clubs ---------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  uid uuid not null references auth.users (id) on delete cascade,
  role text not null default 'organizer' check (role in ('owner', 'organizer')),
  joined_at timestamptz not null default now(),
  primary key (club_id, uid)
);

-- Join codes live apart from clubs so club names can be public while codes are not.
create table public.club_invites (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
);

alter table public.events
  add column club_id uuid references public.clubs (id) on delete set null,
  add column food_items text[] not null default '{}';

create index events_club_idx on public.events (club_id);

create function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members m where m.club_id = p_club_id and m.uid = auth.uid()
  );
$$;

-- True for the event's creator and for every organizer of its club.
create function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (e.created_by = auth.uid()
        or (e.club_id is not null and public.is_club_member(e.club_id)))
  );
$$;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invites enable row level security;

create policy "clubs are public" on public.clubs for select using (true);
create policy "members see their club's members" on public.club_members
  for select to authenticated using (public.is_club_member(club_id));
create policy "members see their club's join code" on public.club_invites
  for select to authenticated using (public.is_club_member(club_id));

create function public.create_club(p_name text)
returns public.clubs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club public.clubs;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  insert into public.clubs (name, created_by) values (trim(p_name), auth.uid()) returning * into v_club;
  insert into public.club_members (club_id, uid, role) values (v_club.id, auth.uid(), 'owner');
  insert into public.club_invites (club_id) values (v_club.id);
  return v_club;
end;
$$;

-- Returns the club joined, or null when the code is wrong.
create function public.join_club(p_code text)
returns public.clubs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club public.clubs;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  select c.* into v_club
    from public.club_invites i join public.clubs c on c.id = i.club_id
    where i.code = upper(trim(p_code));
  if not found then
    return null;
  end if;
  insert into public.club_members (club_id, uid) values (v_club.id, auth.uid())
    on conflict do nothing;
  return v_club;
end;
$$;

create function public.club_roster(p_club_id uuid)
returns table (uid uuid, member_name text, role text, joined_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select m.uid, coalesce(nullif(p.full_name, ''), 'Organizer'), m.role, m.joined_at
  from public.club_members m
  left join public.profiles p on p.id = m.uid
  where m.club_id = p_club_id and public.is_club_member(p_club_id)
  order by m.joined_at;
$$;

-- Events: club organizers can post for their club and manage its events.

drop policy "signed-in users post events" on public.events;
create policy "signed-in users post events" on public.events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (club_id is null or public.is_club_member(club_id))
  );

drop policy "owners edit their events" on public.events;
create policy "managers edit their events" on public.events
  for update to authenticated using (public.can_manage_event(id));

drop policy "owners delete their events" on public.events;
create policy "managers delete their events" on public.events
  for delete to authenticated using (public.can_manage_event(id));

-- Door check-in and guest list: any manager of the event ----------------------

create or replace function public.check_in(p_code text)
returns table (ok boolean, reason text, guest_name text, event_id uuid, checked_in_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rsvp public.rsvps;
  v_name text;
begin
  select * into v_rsvp from public.rsvps r where r.code = upper(trim(p_code)) for update;
  if not found then
    return query select false, 'not_found', null::text, null::uuid, null::timestamptz;
    return;
  end if;

  if not public.can_manage_event(v_rsvp.event_id) then
    return query select false, 'not_host', null::text, v_rsvp.event_id, null::timestamptz;
    return;
  end if;

  select nullif(p.full_name, '') into v_name from public.profiles p where p.id = v_rsvp.uid;

  if v_rsvp.checked_in_at is not null then
    return query select false, 'already_checked_in', coalesce(v_name, 'Guest'), v_rsvp.event_id, v_rsvp.checked_in_at;
    return;
  end if;

  update public.rsvps r set checked_in_at = now() where r.id = v_rsvp.id;
  update public.events e set checked_in_count = e.checked_in_count + 1 where e.id = v_rsvp.event_id;
  return query select true, null::text, coalesce(v_name, 'Guest'), v_rsvp.event_id, now();
end;
$$;

-- For a guest whose phone is dead: check in from the guest list.
create function public.check_in_guest(p_rsvp_id uuid)
returns table (ok boolean, reason text, guest_name text, event_id uuid, checked_in_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select c.* from public.rsvps r, public.check_in(r.code) c where r.id = p_rsvp_id;
$$;

create or replace function public.event_guests(p_event_id uuid)
returns table (rsvp_id uuid, guest_name text, sfsu_verified boolean, created_at timestamptz, checked_in_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select r.id, coalesce(nullif(p.full_name, ''), 'Guest'), coalesce(p.sfsu_verified, false),
         r.created_at, r.checked_in_at
  from public.rsvps r
  left join public.profiles p on p.id = r.uid
  where r.event_id = p_event_id and public.can_manage_event(p_event_id)
  order by r.created_at;
$$;

-- Organizer analytics: one row per registration across every event the caller manages.
create function public.host_attendance()
returns table (
  event_id uuid,
  rsvp_id uuid,
  guest_id uuid,
  guest_name text,
  major text,
  grad_year integer,
  sfsu_verified boolean,
  registered_at timestamptz,
  checked_in_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select e.id, r.id, r.uid, coalesce(nullif(p.full_name, ''), 'Guest'), coalesce(p.major, ''),
         p.grad_year, coalesce(p.sfsu_verified, false), r.created_at, r.checked_in_at
  from public.events e
  join public.rsvps r on r.event_id = e.id
  left join public.profiles p on p.id = r.uid
  where e.created_by = auth.uid()
     or (e.club_id is not null and public.is_club_member(e.club_id))
  order by r.created_at;
$$;

-- Food: only from an event you manage --------------------------------------

drop policy "signed-in users post rescues" on public.food_rescues;
create policy "managers post food from their events" on public.food_rescues
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and event_id is not null
    and public.can_manage_event(event_id)
  );

drop policy "owners edit their rescues" on public.food_rescues;
create policy "managers edit their rescues" on public.food_rescues
  for update to authenticated
  using (created_by = (select auth.uid()) or public.can_manage_event(event_id));

-- Claims: a 15 minute hold with a pickup code ---------------------------------

alter table public.claims
  add column code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
  add column expires_at timestamptz not null default now() + interval '15 minutes',
  add column picked_up_at timestamptz;

-- Puts portions from expired, never picked up holds back on the list.
create function public.release_expired_claims()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  with released as (
    delete from public.claims c
      where c.picked_up_at is null and c.expires_at < now()
      returning c.rescue_id
  ),
  counts as (
    select rescue_id, count(*)::integer as n from released group by rescue_id
  ),
  updated as (
    update public.food_rescues r
      set portions_left = least(r.portions, r.portions_left + c.n),
          status = case when r.status = 'gone' then 'open' else r.status end
      from counts c
      where r.id = c.rescue_id
      returning c.n
  )
  select coalesce(sum(n), 0) into v_total from updated;
  return v_total;
end;
$$;

drop function public.claim_portion(uuid);
create function public.claim_portion(p_rescue_id uuid)
returns table (ok boolean, portions_left integer, reason text, claim_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rescue public.food_rescues%rowtype;
  v_mine integer;
  v_claim public.claims;
begin
  if v_uid is null then
    return query select false, 0, 'not_signed_in', null::text, null::timestamptz;
    return;
  end if;

  perform public.release_expired_claims();

  -- The row lock serializes claims on one rescue, so the counts below are exact.
  select * into v_rescue from public.food_rescues r where r.id = p_rescue_id for update;

  if not found then
    return query select false, 0, 'not_found', null::text, null::timestamptz;
    return;
  end if;

  if v_rescue.status <> 'open' or v_rescue.portions_left <= 0 then
    return query select false, v_rescue.portions_left, 'gone', null::text, null::timestamptz;
    return;
  end if;

  if v_rescue.safe_until < now() then
    update public.food_rescues r set status = 'expired' where r.id = p_rescue_id;
    return query select false, v_rescue.portions_left, 'expired', null::text, null::timestamptz;
    return;
  end if;

  select count(*) into v_mine from public.claims c
    where c.rescue_id = p_rescue_id and c.uid = v_uid;

  if v_mine >= v_rescue.max_per_person then
    return query select false, v_rescue.portions_left, 'already_claimed', null::text, null::timestamptz;
    return;
  end if;

  insert into public.claims (rescue_id, uid) values (p_rescue_id, v_uid) returning * into v_claim;

  update public.food_rescues r
    set portions_left = r.portions_left - 1,
        status = case when r.portions_left - 1 = 0 then 'gone' else r.status end
    where r.id = p_rescue_id;

  return query select true, v_rescue.portions_left - 1, null::text, v_claim.code, v_claim.expires_at;
end;
$$;

-- The poster (or any organizer of the event) confirms a pickup by its code.
create function public.confirm_pickup(p_rescue_id uuid, p_code text)
returns table (ok boolean, reason text, guest_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rescue public.food_rescues;
  v_claim public.claims;
  v_name text;
begin
  select * into v_rescue from public.food_rescues r where r.id = p_rescue_id;
  if not found
     or not (v_rescue.created_by = auth.uid() or public.can_manage_event(v_rescue.event_id)) then
    return query select false, 'not_host', null::text;
    return;
  end if;

  select * into v_claim from public.claims c
    where c.rescue_id = p_rescue_id and c.code = upper(trim(p_code))
    order by c.picked_up_at nulls first
    limit 1
    for update;
  if not found then
    return query select false, 'not_found', null::text;
    return;
  end if;

  select coalesce(nullif(p.full_name, ''), 'Guest') into v_name
    from public.profiles p where p.id = v_claim.uid;

  if v_claim.picked_up_at is not null then
    return query select false, 'already_picked_up', coalesce(v_name, 'Guest');
    return;
  end if;

  update public.claims c set picked_up_at = now() where c.id = v_claim.id;
  return query select true, null::text, coalesce(v_name, 'Guest');
end;
$$;

-- Holds on a rescue, for its poster. Codes are not included: the student shows theirs.
create function public.rescue_claims(p_rescue_id uuid)
returns table (claim_id uuid, guest_name text, created_at timestamptz, expires_at timestamptz, picked_up_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select c.id, coalesce(nullif(p.full_name, ''), 'Guest'), c.created_at, c.expires_at, c.picked_up_at
  from public.claims c
  join public.food_rescues r on r.id = c.rescue_id
  left join public.profiles p on p.id = c.uid
  where c.rescue_id = p_rescue_id
    and (r.created_by = auth.uid() or public.can_manage_event(r.event_id))
  order by c.created_at;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_club_member(uuid)', 'can_manage_event(uuid)', 'create_club(text)', 'join_club(text)',
    'club_roster(uuid)', 'check_in_guest(uuid)', 'host_attendance()', 'release_expired_claims()',
    'claim_portion(uuid)', 'confirm_pickup(uuid, text)', 'rescue_claims(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
