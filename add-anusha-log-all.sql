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

select email, is_owner, can_log_all from public.team_access order by email;
