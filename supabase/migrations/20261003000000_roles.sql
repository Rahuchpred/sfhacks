-- Round 4: locked roles. A signed-in account picks student, faculty or recruiter
-- once. Guests (anonymous sessions) have no role and can only browse.

alter table public.profiles
  add column role text check (role in ('student', 'faculty', 'recruiter')),
  add column is_demo boolean not null default false,
  add column department text not null default '',
  add column company text not null default '';

-- Students who had already opted in before roles existed stay findable.
update public.profiles set role = 'student' where role is null and recruiter_visible;

-- role and is_demo never come from the client. Only the functions below (which
-- raise the flag for their own write), the service role and direct SQL set them.
create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.role_write', true), '') = '1'
     or coalesce(auth.role(), 'service_role') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.role := null;
    new.is_demo := false;
  else
    new.role := old.role;
    new.is_demo := old.is_demo;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- The caller's role, for policies. Null for guests.
create function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Picks the role, once. Students and faculty need an SFSU email. Calling it
-- again returns the profile unchanged, so the first choice stays locked.
create function public.set_my_role(p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if p_role is null or p_role not in ('student', 'faculty', 'recruiter') then
    raise exception 'bad_role';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if coalesce(v_email, '') = '' then
    raise exception 'email_required';
  end if;

  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;
  select * into v_profile from public.profiles p where p.id = v_uid for update;
  if v_profile.role is not null then
    return v_profile;
  end if;

  if p_role <> 'recruiter' and not v_profile.is_demo
     and not (v_email ilike '%@sfsu.edu' or v_email ilike '%@mail.sfsu.edu') then
    raise exception 'sfsu_email_required';
  end if;

  perform set_config('app.role_write', '1', true);
  update public.profiles p set role = p_role where p.id = v_uid returning * into v_profile;
  perform set_config('app.role_write', '', true);
  return v_profile;
end;
$$;

-- The demo switch: only an account marked is_demo can change its role.
create function public.demo_set_role(p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if p_role is null or p_role not in ('student', 'faculty', 'recruiter') then
    raise exception 'bad_role';
  end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_demo) then
    raise exception 'not_demo';
  end if;

  perform set_config('app.role_write', '1', true);
  update public.profiles p set role = p_role where p.id = auth.uid() returning * into v_profile;
  perform set_config('app.role_write', '', true);
  return v_profile;
end;
$$;

revoke all on function public.protect_profile_role() from public, anon, authenticated;
revoke all on function public.my_role() from public;
revoke all on function public.set_my_role(text) from public, anon;
revoke all on function public.demo_set_role(text) from public, anon;
grant execute on function public.my_role() to anon, authenticated;
grant execute on function public.set_my_role(text) to authenticated;
grant execute on function public.demo_set_role(text) to authenticated;

-- A profile is visible to its owner. Recruiters, and nobody else, also see the
-- students who opted in.
drop policy "own profile or opted-in" on public.profiles;
create policy "own profile, or opted-in students for recruiters" on public.profiles
  for select using (
    id = (select auth.uid())
    or (recruiter_visible and role = 'student' and (select public.my_role()) = 'recruiter')
  );

-- Attendance of opted-in students, for recruiters only.
create or replace function public.visible_attendance()
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
    and p.role = 'student'
    and public.my_role() = 'recruiter'
  order by e.starts_at desc;
$$;

-- Only faculty and staff ask for help.
drop policy "signed-in users post requests" on public.help_requests;
create policy "faculty post requests" on public.help_requests
  for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.my_role()) = 'faculty');
