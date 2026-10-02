-- A fourth role: campus safety staff, who post alerts on the map. It is never offered in
-- the onboarding. An admin sets it, or a demo account switches to it.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'faculty', 'recruiter', 'safety'));

create or replace function public.demo_set_role(p_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if p_role is null or p_role not in ('student', 'faculty', 'recruiter', 'safety') then
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
