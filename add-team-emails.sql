-- Run once in Supabase → SQL Editor to let the team sign in.
insert into public.team_access (email, is_owner) values
  ('charan.t@ankurahomes.com',        true),
  ('gangothri.s@ankurahomes.com',     false),
  ('anusha.lalagari@ankurahomes.com', false),
  ('saiteja.bharath@ankurahomes.com', false)
on conflict (email) do update set is_owner = excluded.is_owner;
select * from public.team_access;
