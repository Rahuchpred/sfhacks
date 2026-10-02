-- Faculty and staff can look up who attended a campus event, for example to give
-- class credit. Only door check-ins are returned, and only to a faculty account.

create function public.faculty_event_attendance(p_event_id uuid)
returns table (
  guest_id uuid,
  guest_name text,
  major text,
  grad_year integer,
  sfsu_verified boolean,
  registered_at timestamptz,
  checked_in_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.uid, coalesce(nullif(p.full_name, ''), 'Guest'), coalesce(p.major, ''),
         p.grad_year, coalesce(p.sfsu_verified, false), r.created_at, r.checked_in_at
  from public.rsvps r
  left join public.profiles p on p.id = r.uid
  where r.event_id = p_event_id
    and r.checked_in_at is not null
    and public.my_role() = 'faculty'
  order by p.full_name;
$$;

revoke all on function public.faculty_event_attendance(uuid) from public, anon;
grant execute on function public.faculty_event_attendance(uuid) to authenticated;
