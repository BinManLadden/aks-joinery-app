-- AKS Joinery shared workspace. Safe to run again if any policy already exists.
-- Each team signs in with the same shared account; only that authenticated account can access its row.
create table if not exists public.aks_joinery_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.aks_joinery_workspaces enable row level security;

grant select, insert, update on table public.aks_joinery_workspaces to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='aks_joinery_workspaces' and policyname='AKS team can read its workspace') then
    create policy "AKS team can read its workspace" on public.aks_joinery_workspaces for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='aks_joinery_workspaces' and policyname='AKS team can create its workspace') then
    create policy "AKS team can create its workspace" on public.aks_joinery_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='aks_joinery_workspaces' and policyname='AKS team can update its workspace') then
    create policy "AKS team can update its workspace" on public.aks_joinery_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end
$$;
