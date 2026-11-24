-- Row level security. The microservices use the service role (bypasses RLS);
-- these policies protect direct access with the anon/publishable key.

create schema if not exists private;

-- Lives outside the exposed API schema so it can't be called over RPC.
create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

alter table public.intentions       enable row level security;
alter table public.news             enable row level security;
alter table public.projects         enable row level security;
alter table public.partners         enable row level security;
alter table public.contact_messages enable row level security;
alter table public.admins           enable row level security;

create policy "public read intentions" on public.intentions for select to anon, authenticated using (true);
create policy "public read projects"   on public.projects   for select to anon, authenticated using (true);
create policy "public read partners"   on public.partners   for select to anon, authenticated using (true);

create policy "public read published news" on public.news
  for select to anon, authenticated using (is_published or (select private.is_admin()));
create policy "admins write news" on public.news
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "admins read messages" on public.contact_messages
  for select to authenticated using ((select private.is_admin()));
create policy "admins update messages" on public.contact_messages
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "admins see themselves" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

grant usage on schema private to anon, authenticated;
