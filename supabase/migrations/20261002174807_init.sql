-- Gator Radar schema: campus events, leftover-food rescues, and claims.

create table public.buildings (
  id text primary key,
  name text not null,
  aliases text[] not null default '{}',
  lat double precision not null,
  lng double precision not null
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  club_name text not null default '',
  building_id text not null references public.buildings (id),
  room text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  tags text[] not null default '{}',
  has_food boolean not null default false,
  flyer_url text,
  source text not null default 'organizer' check (source in ('organizer', 'flyer', 'seed')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.food_rescues (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete set null,
  building_id text not null references public.buildings (id),
  room text,
  photo_url text not null,
  items text not null,
  portions integer not null check (portions > 0),
  portions_left integer not null check (portions_left >= 0),
  dietary text[] not null default '{}',
  safe_until timestamptz not null,
  status text not null default 'open' check (status in ('open', 'gone', 'expired')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  rescue_id uuid not null references public.food_rescues (id) on delete cascade,
  uid uuid not null,
  created_at timestamptz not null default now(),
  unique (rescue_id, uid)
);

create index events_starts_at_idx on public.events (starts_at);
create index food_rescues_status_idx on public.food_rescues (status, safe_until);

alter table public.buildings enable row level security;
alter table public.events enable row level security;
alter table public.food_rescues enable row level security;
alter table public.claims enable row level security;

create policy "buildings are public" on public.buildings for select using (true);

create policy "events are public" on public.events for select using (true);
create policy "signed-in users post events" on public.events
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "owners edit their events" on public.events
  for update to authenticated using (created_by = (select auth.uid()));
create policy "owners delete their events" on public.events
  for delete to authenticated using (created_by = (select auth.uid()));

create policy "rescues are public" on public.food_rescues for select using (true);
create policy "signed-in users post rescues" on public.food_rescues
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "owners edit their rescues" on public.food_rescues
  for update to authenticated using (created_by = (select auth.uid()));

-- Claims are only written through claim_portion(); users may read their own.
create policy "users read their claims" on public.claims
  for select to authenticated using (uid = (select auth.uid()));

-- Atomically take one portion. Locks the rescue row so portions never go
-- below zero, and the unique (rescue_id, uid) keeps it to one per person.
create function public.claim_portion(p_rescue_id uuid)
returns table (ok boolean, portions_left integer, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rescue public.food_rescues%rowtype;
begin
  if v_uid is null then
    return query select false, 0, 'not_signed_in';
    return;
  end if;

  select * into v_rescue from public.food_rescues r where r.id = p_rescue_id for update;

  if not found then
    return query select false, 0, 'not_found';
    return;
  end if;

  if v_rescue.status <> 'open' or v_rescue.portions_left <= 0 then
    return query select false, v_rescue.portions_left, 'gone';
    return;
  end if;

  if v_rescue.safe_until < now() then
    update public.food_rescues r set status = 'expired' where r.id = p_rescue_id;
    return query select false, v_rescue.portions_left, 'expired';
    return;
  end if;

  begin
    insert into public.claims (rescue_id, uid) values (p_rescue_id, v_uid);
  exception when unique_violation then
    return query select false, v_rescue.portions_left, 'already_claimed';
    return;
  end;

  update public.food_rescues r
    set portions_left = r.portions_left - 1,
        status = case when r.portions_left - 1 = 0 then 'gone' else r.status end
    where r.id = p_rescue_id;

  return query select true, v_rescue.portions_left - 1, null::text;
end;
$$;

revoke all on function public.claim_portion(uuid) from public, anon;
grant execute on function public.claim_portion(uuid) to authenticated;

alter publication supabase_realtime add table public.events, public.food_rescues;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "signed-in users upload images" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');
