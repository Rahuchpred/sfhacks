-- Private notes the club writes after an event ("two pizzas left over"), read by the
-- AI insights to suggest better amounts next time. Organizers edit them through the
-- existing event update policy.
alter table public.events add column host_notes text not null default ''
  check (length(host_notes) <= 1000);
