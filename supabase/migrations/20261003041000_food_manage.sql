-- Round 5: a club closes ("Food is gone"), reopens or removes a food post by hand,
-- and every student holding a portion is told the food is no longer available.

-- Set while the club has closed the post by hand. The status is 'gone' meanwhile, so
-- every reader that only knows open, gone and expired keeps working.
alter table public.food_rescues add column closed_at timestamptz;

-- One row per student per closed or removed post. A cancelled hold leaves the claims
-- table, so pickup codes, limits and counts need no "cancelled" case. The notice keeps
-- the food name, because a removed post is deleted and cannot be read any more.
create table public.claim_notices (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null,
  rescue_id uuid not null, -- no foreign key: the post may be gone
  food_name text not null,
  reason text not null check (reason in ('closed', 'removed')),
  portions integer not null check (portions > 0),
  claim_ids uuid[] not null,
  created_at timestamptz not null default now()
);

create index claim_notices_uid_idx on public.claim_notices (uid, created_at desc);

alter table public.claim_notices enable row level security;

create policy "students read their notices" on public.claim_notices
  for select to authenticated using (uid = (select auth.uid()));
create policy "students dismiss their notices" on public.claim_notices
  for delete to authenticated using (uid = (select auth.uid()));

-- Cancels every hold on a post that was not picked up, and leaves one notice per
-- student. Returns the number of portions freed. Internal: callers check permission.
create function public.cancel_rescue_holds(p_rescue_id uuid, p_food_name text, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  -- Old notices nobody dismissed.
  delete from public.claim_notices n where n.created_at < now() - interval '2 days';

  with cancelled as (
    delete from public.claims c
      where c.rescue_id = p_rescue_id and c.picked_up_at is null
      returning c.id, c.uid, c.expires_at
  ),
  -- A hold that had already run out gets no notice: the student sees "Hold expired".
  told as (
    insert into public.claim_notices (uid, rescue_id, food_name, reason, portions, claim_ids)
      select c.uid, p_rescue_id, p_food_name, p_reason, count(*)::integer, array_agg(c.id)
      from cancelled c
      where c.expires_at > now()
      group by c.uid
      returning 1
  )
  select count(*)::integer into v_total from cancelled;
  return v_total;
end;
$$;

-- True for the poster and for anyone who can manage the post's event. Null-safe: a
-- post with no poster (seed data) and no event belongs to nobody.
create function public.can_run_rescue(p_rescue public.food_rescues)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_rescue.created_by = auth.uid(), false)
      or public.can_staff_event(p_rescue.event_id);
$$;

-- "Food is gone": the post leaves the Free food page and its open holds are cancelled.
create function public.close_rescue(p_rescue_id uuid)
returns table (ok boolean, reason text, cancelled integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rescue public.food_rescues;
  v_freed integer;
begin
  -- The row lock keeps a claim from landing between the cancel and the close.
  select * into v_rescue from public.food_rescues r where r.id = p_rescue_id for update;
  if not found then
    return query select false, 'not_found', 0;
    return;
  end if;
  if not public.can_run_rescue(v_rescue) then
    return query select false, 'not_host', 0;
    return;
  end if;
  -- A second click on an already closed post changes nothing.
  if v_rescue.closed_at is not null then
    return query select true, null::text, 0;
    return;
  end if;

  v_freed := public.cancel_rescue_holds(p_rescue_id, v_rescue.items, 'closed');

  update public.food_rescues r
    set portions_left = least(r.portions, r.portions_left + v_freed),
        status = 'gone',
        closed_at = now()
    where r.id = p_rescue_id;

  return query select true, null::text, v_freed;
end;
$$;

-- Puts a closed post back on the Free food page, while it is inside its safe-until time.
create function public.reopen_rescue(p_rescue_id uuid)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rescue public.food_rescues;
begin
  select * into v_rescue from public.food_rescues r where r.id = p_rescue_id for update;
  if not found then
    return query select false, 'not_found';
    return;
  end if;
  if not public.can_run_rescue(v_rescue) then
    return query select false, 'not_host';
    return;
  end if;
  if v_rescue.closed_at is null then
    return query select true, null::text;
    return;
  end if;
  if v_rescue.safe_until <= now() then
    return query select false, 'expired';
    return;
  end if;

  update public.food_rescues r
    set closed_at = null,
        status = case when r.portions_left > 0 then 'open' else 'gone' end
    where r.id = p_rescue_id;

  return query select true, null::text;
end;
$$;

-- "Remove post": deletes a post made by mistake. Its claims go with it (cascade), so
-- the holders are told through claim_notices first.
create function public.remove_rescue(p_rescue_id uuid)
returns table (ok boolean, reason text, cancelled integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rescue public.food_rescues;
  v_freed integer;
begin
  select * into v_rescue from public.food_rescues r where r.id = p_rescue_id for update;
  if not found then
    return query select false, 'not_found', 0;
    return;
  end if;
  if not public.can_run_rescue(v_rescue) then
    return query select false, 'not_host', 0;
    return;
  end if;

  v_freed := public.cancel_rescue_holds(p_rescue_id, v_rescue.items, 'removed');
  delete from public.food_rescues r where r.id = p_rescue_id;

  return query select true, null::text, v_freed;
end;
$$;

-- Every food post the caller may run, newest first, with its live hold counts.
create function public.host_food_posts()
returns table (
  id uuid,
  event_id uuid,
  event_title text,
  building_id text,
  room text,
  photo_url text,
  items text,
  portions integer,
  portions_left integer,
  max_per_person integer,
  dietary text[],
  safe_until timestamptz,
  status text,
  created_by uuid,
  created_at timestamptz,
  closed_at timestamptz,
  held integer,
  picked_up integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.event_id, e.title, r.building_id, r.room, r.photo_url, r.items,
         r.portions, r.portions_left, r.max_per_person, r.dietary, r.safe_until,
         r.status, r.created_by, r.created_at, r.closed_at,
         (select count(*)::integer from public.claims c
            where c.rescue_id = r.id and c.picked_up_at is null and c.expires_at > now()),
         (select count(*)::integer from public.claims c
            where c.rescue_id = r.id and c.picked_up_at is not null)
  from public.food_rescues r
  left join public.events e on e.id = r.event_id
  where r.created_by = auth.uid() or public.can_staff_event(r.event_id)
  order by r.created_at desc;
$$;

-- Events the caller can post food from: started, and not over for more than 12 hours.
create function public.host_food_events()
returns setof public.events
language sql
stable
security definer
set search_path = ''
as $$
  select e.* from public.events e
  where e.starts_at <= now()
    and e.ends_at > now() - interval '12 hours'
    and public.can_staff_event(e.id)
  order by e.starts_at desc;
$$;

revoke all on function public.cancel_rescue_holds(uuid, text, text) from public, anon, authenticated;
revoke all on function public.can_run_rescue(public.food_rescues) from public, anon, authenticated;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'close_rescue(uuid)', 'reopen_rescue(uuid)', 'remove_rescue(uuid)',
    'host_food_posts()', 'host_food_events()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end;
$$;
