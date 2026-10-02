-- The poster decides how many portions one student may claim from a rescue.

alter table public.food_rescues
  add column max_per_person integer not null default 1
  check (max_per_person between 1 and 10);

-- One claim row per portion, so a student can hold several rows up to the limit.
alter table public.claims drop constraint claims_rescue_id_uid_key;
create index claims_rescue_uid_idx on public.claims (rescue_id, uid);

create or replace function public.claim_portion(p_rescue_id uuid)
returns table (ok boolean, portions_left integer, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rescue public.food_rescues%rowtype;
  v_mine integer;
begin
  if v_uid is null then
    return query select false, 0, 'not_signed_in';
    return;
  end if;

  -- The row lock serializes claims on one rescue, so the counts below are exact.
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

  select count(*) into v_mine from public.claims c
    where c.rescue_id = p_rescue_id and c.uid = v_uid;

  if v_mine >= v_rescue.max_per_person then
    return query select false, v_rescue.portions_left, 'already_claimed';
    return;
  end if;

  insert into public.claims (rescue_id, uid) values (p_rescue_id, v_uid);

  update public.food_rescues r
    set portions_left = r.portions_left - 1,
        status = case when r.portions_left - 1 = 0 then 'gone' else r.status end
    where r.id = p_rescue_id;

  return query select true, v_rescue.portions_left - 1, null::text;
end;
$$;
