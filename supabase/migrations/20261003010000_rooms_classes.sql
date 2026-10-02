-- Round 4: campus data for the event planner. Rooms and the class schedule are
-- loaded by scripts/load-classes.mjs from the public SFSU class search.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  building_id text not null references public.buildings (id),
  room text not null,
  -- The largest class capacity seen in this room.
  capacity integer not null check (capacity > 0),
  kind text not null default 'classroom' check (kind in ('classroom', 'lecture_hall', 'lab', 'activity')),
  -- True when the row was generated and is not from the real schedule.
  sample boolean not null default false,
  unique (building_id, room)
);

-- One row per meeting pattern of a class section. A section that meets in two
-- rooms has two rows. building_id is null for places that are not on our map
-- (online, off campus, other buildings): those rows still count for clashes.
create table public.class_sections (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  subject text not null,
  number text not null,
  section text not null default '',
  class_number text,
  title text not null,
  component text not null default '',
  building_id text references public.buildings (id),
  room text,
  -- Lowercase three-letter weekdays: mon, tue, wed, thu, fri, sat, sun.
  days text[] not null,
  -- Wall clock time on campus (America/Los_Angeles).
  start_time time not null,
  end_time time not null,
  -- First and last day of instruction, null when unknown.
  starts_on date,
  ends_on date,
  enrolled integer not null default 0,
  capacity integer not null default 0,
  sample boolean not null default false
);

create index class_sections_room_idx on public.class_sections (building_id, room);
create index class_sections_subject_idx on public.class_sections (subject);

alter table public.rooms enable row level security;
alter table public.class_sections enable row level security;

create policy "rooms are public" on public.rooms for select using (true);
create policy "class sections are public" on public.class_sections for select using (true);

-- Who comes to a club's events, as counts per major. No names and no rows per
-- person, and only for an organizer of that club.
create function public.club_audience_majors(p_club_id uuid)
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
    where e.club_id = p_club_id and public.is_club_member(p_club_id)
  ) a
  group by a.major
  order by count(*) desc;
$$;

revoke all on function public.club_audience_majors(uuid) from public, anon;
grant execute on function public.club_audience_majors(uuid) to authenticated;
