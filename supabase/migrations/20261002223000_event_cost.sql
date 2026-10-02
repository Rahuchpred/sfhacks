-- What the event cost, entered by the organizer. Used for cost per attendee and school reports.
alter table public.events add column cost numeric(10, 2) check (cost is null or cost >= 0);
