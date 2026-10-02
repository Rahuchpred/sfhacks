-- Round 5: club levels. A club has one owner, organizers and members.
--   owner and organizer: post, edit and cancel the club's events, read its data.
--   member: helps at the events. Checks guests in at the door and posts leftover
--           food. No analytics, no reports, no editing.
-- Only the owner changes levels or removes people. Joining with the invite code
-- gives "member". Rows that exist today keep their level.

alter table public.club_members drop constraint club_members_role_check;
alter table public.club_members
  add constraint club_members_role_check check (role in ('owner', 'organizer', 'member'));
alter table public.club_members alter column role set default 'member';

-- Who is who ------------------------------------------------------------------

-- The caller's level in a club: 'owner', 'organizer', 'member', or null.
create function public.club_level(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.club_members m
  where m.club_id = p_club_id and m.uid = auth.uid();
$$;

-- True for the owner and the organizers. is_club_member() stays true for every level.
create function public.is_club_organizer(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members m
    where m.club_id = p_club_id and m.uid = auth.uid() and m.role in ('owner', 'organizer')
  );
$$;

-- Edit, cancel and read the data of an event. A club event belongs to the club:
-- its owner and organizers manage it, whoever posted it. An event with no club
-- belongs to the person who posted it.
create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and ((e.club_id is null and e.created_by = auth.uid())
        or (e.club_id is not null and public.is_club_organizer(e.club_id)))
  );
$$;

-- Work at an event (the door and the leftover food): everyone who can manage it,
-- and the members of its club. Someone removed from a club loses its events.
create function public.can_staff_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and ((e.club_id is null and e.created_by = auth.uid())
        or (e.club_id is not null and public.is_club_member(e.club_id)))
  );
$$;

-- Joining and the roster --------------------------------------------------------

-- Returns the club joined, or null when the code is wrong. A new person is a member.
create or replace function public.join_club(p_code text)
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
  insert into public.club_members (club_id, uid, role) values (v_club.id, auth.uid(), 'member')
    on conflict do nothing;
  return v_club;
end;
$$;

-- Owner first, then organizers, then members.
create or replace function public.club_roster(p_club_id uuid)
returns table (uid uuid, member_name text, role text, joined_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select m.uid, coalesce(nullif(p.full_name, ''), 'Member'), m.role, m.joined_at
  from public.club_members m
  left join public.profiles p on p.id = m.uid
  where m.club_id = p_club_id and public.is_club_member(p_club_id)
  order by case m.role when 'owner' then 0 when 'organizer' then 1 else 2 end, m.joined_at;
$$;

-- The owner makes another person an organizer or a member. The owner's own level
-- never changes here.
create function public.set_club_member_level(p_club_id uuid, p_uid uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.club_level(p_club_id), '') <> 'owner' then
    raise exception 'not_owner';
  end if;
  if p_role is null or p_role not in ('organizer', 'member') then
    raise exception 'bad_level';
  end if;
  update public.club_members m set role = p_role
    where m.club_id = p_club_id and m.uid = p_uid and m.role <> 'owner';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- The owner removes another person from the club.
create function public.remove_club_member(p_club_id uuid, p_uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.club_level(p_club_id), '') <> 'owner' then
    raise exception 'not_owner';
  end if;
  delete from public.club_members m
    where m.club_id = p_club_id and m.uid = p_uid and m.role <> 'owner';
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- Only the owner and organizers invite people.
drop policy "members see their club's join code" on public.club_invites;
create policy "organizers see their club's join code" on public.club_invites
  for select to authenticated using (public.is_club_organizer(club_id));

-- Events: posting for a club needs organizer level -------------------------------

drop policy "signed-in users post events" on public.events;
create policy "signed-in users post events" on public.events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (club_id is null or public.is_club_organizer(club_id))
  );

-- Moving an event into a club needs organizer level in that club too.
drop policy "managers edit their events" on public.events;
create policy "managers edit their events" on public.events
  for update to authenticated
  using (public.can_manage_event(id))
  with check (club_id is null or public.is_club_organizer(club_id));

-- The door: every level ---------------------------------------------------------

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

  if not public.can_staff_event(v_rsvp.event_id) then
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

-- The list at the door: names and check-in times, nothing else about the guest.
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
  where r.event_id = p_event_id and public.can_staff_event(p_event_id)
  order by r.created_at;
$$;

-- Data: owner and organizers only ---------------------------------------------

create or replace function public.host_attendance()
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
  where (e.club_id is null and e.created_by = auth.uid())
     or (e.club_id is not null and public.is_club_organizer(e.club_id))
  order by r.created_at;
$$;

create or replace function public.club_audience_majors(p_club_id uuid)
returns table (major text, attendees integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.major, count(*)::integer
  from (
    select distinct r.uid, coalesce(nullif(trim(p.major), ''), 'Not given') as major
    from public.events e
    join public.rsvps r on r.event_id = e.id and r.checked_in_at is not null
    left join public.profiles p on p.id = r.uid
    where e.club_id = p_club_id and public.is_club_organizer(p_club_id)
  ) a
  group by a.major
  order by count(*) desc;
$$;

-- Leftover food: every level posts it and confirms pickups ------------------------

drop policy "managers post food from their events" on public.food_rescues;
create policy "event staff post food from their events" on public.food_rescues
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and event_id is not null
    and public.can_staff_event(event_id)
  );

create or replace function public.confirm_pickup(p_rescue_id uuid, p_code text)
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
     or not (v_rescue.created_by = auth.uid() or public.can_staff_event(v_rescue.event_id)) then
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

create or replace function public.rescue_claims(p_rescue_id uuid)
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
    and (r.created_by = auth.uid() or public.can_staff_event(r.event_id))
  order by c.created_at;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'club_level(uuid)', 'is_club_organizer(uuid)', 'can_staff_event(uuid)',
    'set_club_member_level(uuid, uuid, text)', 'remove_club_member(uuid, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
