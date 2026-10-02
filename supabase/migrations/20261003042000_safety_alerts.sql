-- Alerts that campus safety staff pin on the map: a point, a radius, when it happened and
-- how long it stays. Everyone sees the active ones. Only the safety role posts or clears.

create table public.safety_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  details text check (details is null or char_length(details) <= 280),
  category text not null
    check (category in ('police', 'medical', 'fire', 'hazard', 'closure', 'other')),
  -- The point must be on or right next to the SF State campus.
  lat double precision not null check (lat between 37.7170 and 37.7290),
  lng double precision not null check (lng between -122.4880 and -122.4720),
  radius_m integer not null check (radius_m between 25 and 500),
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null,
  posted_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  -- Not in the future, not older than two days, and shown for one day at most.
  constraint safety_alerts_occurred_check
    check (occurred_at <= created_at + interval '5 minutes'
      and occurred_at >= created_at - interval '48 hours'),
  constraint safety_alerts_expires_check
    check (expires_at > created_at and expires_at <= created_at + interval '24 hours 5 minutes')
);

create index safety_alerts_expires_idx on public.safety_alerts (expires_at desc);

alter table public.safety_alerts enable row level security;

create policy "active alerts are public" on public.safety_alerts
  for select using (cleared_at is null and expires_at > now());

create policy "safety staff read every alert" on public.safety_alerts
  for select to authenticated using ((select public.my_role()) = 'safety');

create policy "safety staff post alerts" on public.safety_alerts
  for insert to authenticated
  with check ((select public.my_role()) = 'safety' and posted_by = (select auth.uid()));

create policy "safety staff clear alerts" on public.safety_alerts
  for update to authenticated
  using ((select public.my_role()) = 'safety')
  with check ((select public.my_role()) = 'safety');

-- The public reads what the alert says, never which officer posted it. An alert is not
-- rewritten after posting: the only change is clearing it. Nobody deletes one.
revoke all on public.safety_alerts from anon, authenticated;
grant select (id, title, details, category, lat, lng, radius_m, occurred_at, expires_at,
  created_at, cleared_at) on public.safety_alerts to anon, authenticated;
grant insert (title, details, category, lat, lng, radius_m, occurred_at, expires_at)
  on public.safety_alerts to authenticated;
grant update (cleared_at) on public.safety_alerts to authenticated;

-- created_at and posted_by always come from the server, and a cleared alert stays cleared.
create function public.safety_alerts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.cleared_at := null;
    if auth.uid() is not null then
      new.posted_by := auth.uid();
    end if;
  elsif old.cleared_at is not null then
    new.cleared_at := old.cleared_at;
  elsif new.cleared_at is not null then
    new.cleared_at := now();
  end if;
  return new;
end;
$$;

create trigger safety_alerts_guard
  before insert or update on public.safety_alerts
  for each row execute function public.safety_alerts_guard();

-- Live updates. A visitor cannot read a cleared alert, so the row change for a clear never
-- reaches them. This sends a small public "changed" message as well, and the map reloads.
create function public.safety_alerts_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('id', case when tg_op = 'DELETE' then old.id else new.id end),
      'changed',
      'safety-alerts',
      false
    );
  exception when others then
    -- A failed message never blocks an alert.
    null;
  end;
  return null;
end;
$$;

revoke all on function public.safety_alerts_broadcast() from public, anon, authenticated;

create trigger safety_alerts_broadcast
  after insert or update or delete on public.safety_alerts
  for each row execute function public.safety_alerts_broadcast();

alter publication supabase_realtime add table public.safety_alerts;
