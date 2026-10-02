-- Help board: faculty and staff ask for one-time help, students offer it.

create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 120),
  description text not null default '',
  requester_name text not null default '',
  department text not null default '',
  building_id text references public.buildings (id),
  time_needed text not null default '',
  skills text[] not null default '{}',
  reward_type text not null check (reward_type in ('course credit', 'reference letter', 'experience', 'volunteer hours', 'paid')),
  reward_detail text not null default '',
  spots integer not null default 1 check (spots between 1 and 20),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.help_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.help_requests (id) on delete cascade,
  uid uuid not null references auth.users (id) on delete cascade,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (request_id, uid)
);

alter table public.help_requests enable row level security;
alter table public.help_offers enable row level security;

create policy "help requests are public" on public.help_requests for select using (true);
create policy "signed-in users post requests" on public.help_requests
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "requesters edit their requests" on public.help_requests
  for update to authenticated using (created_by = (select auth.uid()));
create policy "requesters delete their requests" on public.help_requests
  for delete to authenticated using (created_by = (select auth.uid()));

create policy "students see their offers" on public.help_offers
  for select to authenticated using (uid = (select auth.uid()));
create policy "students offer help" on public.help_offers
  for insert to authenticated
  with check (uid = (select auth.uid()) and status = 'pending');
create policy "students withdraw pending offers" on public.help_offers
  for delete to authenticated using (uid = (select auth.uid()) and status = 'pending');

-- Offers on a request, for the person who posted it.
create function public.help_offers_for(p_request_id uuid)
returns table (
  offer_id uuid, student_id uuid, student_name text, major text, grad_year integer,
  sfsu_verified boolean, events_attended bigint, note text, status text,
  created_at timestamptz, completed_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select o.id, o.uid, coalesce(nullif(p.full_name, ''), 'Student'), coalesce(p.major, ''),
         p.grad_year, coalesce(p.sfsu_verified, false),
         (select count(*) from public.rsvps r where r.uid = o.uid and r.checked_in_at is not null),
         o.note, o.status, o.created_at, o.completed_at
  from public.help_offers o
  join public.help_requests q on q.id = o.request_id
  left join public.profiles p on p.id = o.uid
  where o.request_id = p_request_id and q.created_by = auth.uid()
  order by o.created_at;
$$;

-- The requester accepts, declines or marks an offer done.
create function public.set_help_offer_status(p_offer_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('accepted', 'declined', 'done') then
    raise exception 'bad_status';
  end if;
  update public.help_offers o
    set status = p_status,
        completed_at = case when p_status = 'done' then now() else null end
    from public.help_requests q
    where o.id = p_offer_id and q.id = o.request_id and q.created_by = auth.uid();
  return found;
end;
$$;

revoke all on function public.help_offers_for(uuid) from public, anon;
revoke all on function public.set_help_offer_status(uuid, text) from public, anon;
grant execute on function public.help_offers_for(uuid) to authenticated;
grant execute on function public.set_help_offer_status(uuid, text) to authenticated;

-- Safety notices: official University Police notices only. Rows are written by
-- the server after reading upd.sfsu.edu. Nobody can post one from the app.

create table public.safety_notices (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_url text not null,
  kind text not null default 'timely warning',
  category text not null,
  title text not null,
  summary text not null,
  area text not null default '',
  building_id text references public.buildings (id),
  show_pin boolean not null default false,
  occurred_on date,
  fetched_at timestamptz not null default now()
);

alter table public.safety_notices enable row level security;
create policy "safety notices are public" on public.safety_notices for select using (true);
