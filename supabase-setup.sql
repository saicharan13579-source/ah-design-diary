-- AH Head Office Design Team Diary · Supabase database setup
-- Paste all of this into Supabase → SQL Editor → New query → Run.
-- First change the four emails in the "TEAM EMAILS" block to your team's real Microsoft emails.

create table if not exists public.docs (
  col        text        not null,
  id         text        not null,
  data       jsonb       not null,
  date       text        default '',
  updated_at timestamptz default now(),
  primary key (col, id)
);
create index if not exists docs_col_date on public.docs (col, date);

create table if not exists public.team_access (
  email    text primary key,
  is_owner boolean not null default false
);

-- ===== TEAM EMAILS =====
insert into public.team_access (email, is_owner) values
  ('charan.t@ankurahomes.com',        true),   -- Thabbibbu Sai Charan (owner: only he can edit the team list)
  ('gangothri.s@ankurahomes.com',     false),  -- Sama Gangothri
  ('anusha.lalagari@ankurahomes.com', false),  -- Lalagari Anusha
  ('saiteja.bharath@ankurahomes.com', false)   -- Chinnannagari Bharath Sai Teja
on conflict (email) do update set is_owner = excluded.is_owner;
-- ========================

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_access where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_access where email = lower(coalesce(auth.jwt() ->> 'email', '')) and is_owner);
$$;

alter table public.docs enable row level security;
alter table public.team_access enable row level security;

drop policy if exists "team reads diary" on public.docs;
drop policy if exists "team adds" on public.docs;
drop policy if exists "team edits own" on public.docs;
drop policy if exists "team deletes own" on public.docs;
drop policy if exists "team sees access list" on public.team_access;

create policy "team reads diary" on public.docs for select to authenticated using (public.is_member());

create policy "team adds" on public.docs for insert to authenticated with check (
  public.is_member() and (
    public.is_owner()
    or (col = 'people'  and id = auth.uid()::text)
    or (col = 'entries' and data ->> 'by' = auth.uid()::text)
  )
);

create policy "team edits own" on public.docs for update to authenticated
using (
  public.is_member() and (
    public.is_owner()
    or (col = 'people'  and id = auth.uid()::text)
    or (col = 'entries' and (data ->> 'by' = auth.uid()::text or data ->> 'uid' = auth.uid()::text))
  )
)
with check (
  public.is_member() and (
    public.is_owner()
    or (col = 'people'  and id = auth.uid()::text)
    or (col = 'entries' and data ->> 'by' = auth.uid()::text)
  )
);

create policy "team deletes own" on public.docs for delete to authenticated using (
  public.is_member() and (
    public.is_owner()
    or (col = 'entries' and (data ->> 'by' = auth.uid()::text or data ->> 'uid' = auth.uid()::text))
  )
);

create policy "team sees access list" on public.team_access for select to authenticated using (public.is_member());

-- Team list (only the owner can change it from the page)
insert into public.docs (col, id, data) values ('team', 'roster', '{
  "members": [
    {"id":"emp229","name":"Thabbibbu Sai Charan","role":"Architect · AH-EMP-229","lead":true,"loggedBy":"emp354"},
    {"id":"emp362","name":"Sama Gangothri","role":"Design Junior Engineering · AH-EMP-362","reportsTo":"emp229"},
    {"id":"emp354","name":"Lalagari Anusha","role":"GET, Project Documentation & Coordination · 354","reportsTo":"emp229"},
    {"id":"emp365","name":"Chinnannagari Bharath Sai Teja","role":"3D Visualizer · AH-EMP-365","reportsTo":"emp229"}
  ]}'::jsonb) on conflict (col, id) do nothing;

-- Only team emails can create a diary password
create or replace function public.only_team_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.team_access where email = lower(new.email)) then
    raise exception 'Email is not on the team';
  end if;
  return new;
end $$;
drop trigger if exists only_team_signup on auth.users;
create trigger only_team_signup before insert on auth.users
  for each row execute function public.only_team_signup();
-- Anusha can add, edit and delete diary updates for every team member (team list stays owner-only)
alter table public.team_access add column if not exists can_log_all boolean not null default false;
update public.team_access set can_log_all = true where email = 'anusha.lalagari@ankurahomes.com';

create or replace function public.can_log_all() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_access where email = lower(coalesce(auth.jwt() ->> 'email', '')) and (is_owner or can_log_all));
$$;

drop policy if exists "team adds" on public.docs;
drop policy if exists "team edits own" on public.docs;
drop policy if exists "team deletes own" on public.docs;

create policy "team adds" on public.docs for insert to authenticated with check (
  public.is_member() and (
    public.is_owner()
    or (col = 'people'  and id = auth.uid()::text)
    or (col = 'entries' and data ->> 'by' = auth.uid()::text)
  )
);
create policy "team edits own" on public.docs for update to authenticated
using (
  public.is_member() and (
    public.is_owner()
    or (col = 'people'  and id = auth.uid()::text)
    or (col = 'entries' and (public.can_log_all() or data ->> 'by' = auth.uid()::text or data ->> 'uid' = auth.uid()::text))
  )
)
with check (
  public.is_member() and (
    public.is_owner()
    or (col = 'people'  and id = auth.uid()::text)
    or (col = 'entries' and data ->> 'by' = auth.uid()::text)
  )
);
create policy "team deletes own" on public.docs for delete to authenticated using (
  public.is_member() and (
    public.is_owner()
    or (col = 'entries' and (public.can_log_all() or data ->> 'by' = auth.uid()::text or data ->> 'uid' = auth.uid()::text))
  )
);

