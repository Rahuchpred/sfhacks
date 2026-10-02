-- Round 2: RSVPs with QR tickets, door check-in, and student profiles.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  sfsu_verified boolean not null default false,
  major text not null default '',
  grad_year integer,
  bio text not null default '',
  linkedin_url text,
  github_url text,
  resume_url text,
  ai_summary text,
  recruiter_visible boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  uid uuid not null references auth.users (id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  unique (event_id, uid)
);

create index rsvps_event_idx on public.rsvps (event_id);
create index rsvps_uid_idx on public.rsvps (uid);

-- Public counters on the event, kept exact by the functions below.
alter table public.events
  add column rsvp_count integer not null default 0,
  add column checked_in_count integer not null default 0;

alter table public.profiles enable row level security;
alter table public.rsvps enable row level security;

-- A profile is visible to its owner, and to others only if the student opted in.
create policy "own profile or opted-in" on public.profiles
  for select using (id = (select auth.uid()) or recruiter_visible);
create policy "users create their profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "users edit their profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()));

-- A ticket is visible to its holder. Hosts read guests through event_guests().
create policy "users read their rsvps" on public.rsvps
  for select to authenticated using (uid = (select auth.uid()));

-- sfsu_verified and email come from the signed-in account, never from the client.
create function public.sync_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = new.id;
  new.email := v_email;
  new.sfsu_verified := coalesce(v_email ilike '%@sfsu.edu' or v_email ilike '%@mail.sfsu.edu', false);
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_sync_identity
  before insert or update on public.profiles
  for each row execute function public.sync_profile_identity();

create function public.rsvp_event(p_event_id uuid)
returns public.rsvps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rsvp public.rsvps;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  select * into v_rsvp from public.rsvps r where r.event_id = p_event_id and r.uid = v_uid;
  if found then
    return v_rsvp;
  end if;

  insert into public.rsvps (event_id, uid) values (p_event_id, v_uid) returning * into v_rsvp;
  update public.events e set rsvp_count = e.rsvp_count + 1 where e.id = p_event_id;
  return v_rsvp;
end;
$$;

create function public.cancel_rsvp(p_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rsvp public.rsvps;
begin
  delete from public.rsvps r
    where r.event_id = p_event_id and r.uid = auth.uid()
    returning * into v_rsvp;
  if not found then
    return false;
  end if;

  update public.events e
    set rsvp_count = greatest(e.rsvp_count - 1, 0),
        checked_in_count = greatest(
          e.checked_in_count - case when v_rsvp.checked_in_at is null then 0 else 1 end, 0)
    where e.id = p_event_id;
  return true;
end;
$$;

-- Only the person who created the event can check guests in.
create function public.check_in(p_code text)
returns table (ok boolean, reason text, guest_name text, event_id uuid, checked_in_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rsvp public.rsvps;
  v_owner uuid;
  v_name text;
begin
  select * into v_rsvp from public.rsvps r where r.code = upper(trim(p_code)) for update;
  if not found then
    return query select false, 'not_found', null::text, null::uuid, null::timestamptz;
    return;
  end if;

  select e.created_by into v_owner from public.events e where e.id = v_rsvp.event_id;
  if v_owner is distinct from auth.uid() then
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

-- Guest list for the host of an event. Returns nothing for anyone else.
create function public.event_guests(p_event_id uuid)
returns table (rsvp_id uuid, guest_name text, sfsu_verified boolean, created_at timestamptz, checked_in_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select r.id, coalesce(nullif(p.full_name, ''), 'Guest'), coalesce(p.sfsu_verified, false),
         r.created_at, r.checked_in_at
  from public.rsvps r
  left join public.profiles p on p.id = r.uid
  where r.event_id = p_event_id
    and exists (
      select 1 from public.events e where e.id = p_event_id and e.created_by = auth.uid()
    )
  order by r.created_at;
$$;

revoke all on function public.rsvp_event(uuid) from public, anon;
revoke all on function public.cancel_rsvp(uuid) from public, anon;
revoke all on function public.check_in(text) from public, anon;
revoke all on function public.event_guests(uuid) from public, anon;
grant execute on function public.rsvp_event(uuid) to authenticated;
grant execute on function public.cancel_rsvp(uuid) to authenticated;
grant execute on function public.check_in(text) to authenticated;
grant execute on function public.event_guests(uuid) to authenticated;
