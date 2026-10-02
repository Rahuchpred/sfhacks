-- Events that opted-in students actually checked in to. This is the only way
-- attendance leaves a student's own account, and it skips anyone not opted in.
create function public.visible_attendance()
returns table (
  profile_id uuid,
  event_id uuid,
  title text,
  club_name text,
  tags text[],
  starts_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select p.id, e.id, e.title, e.club_name, e.tags, e.starts_at
  from public.profiles p
  join public.rsvps r on r.uid = p.id and r.checked_in_at is not null
  join public.events e on e.id = r.event_id
  where p.recruiter_visible
  order by e.starts_at desc;
$$;

revoke all on function public.visible_attendance() from public, anon;
grant execute on function public.visible_attendance() to authenticated;
