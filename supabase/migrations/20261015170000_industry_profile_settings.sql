-- Tenant-scoped, persistent configuration for each active industry profile.
create table if not exists public.industry_profile_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  profile_key text not null check (length(trim(profile_key)) between 1 and 120),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, profile_key)
);
create index if not exists industry_profile_settings_company_idx on public.industry_profile_settings(company_id);
alter table public.industry_profile_settings enable row level security;
revoke all on public.industry_profile_settings from anon;
grant select, insert, update, delete on public.industry_profile_settings to authenticated;
drop policy if exists "Active company members can read industry settings" on public.industry_profile_settings;
create policy "Active company members can read industry settings" on public.industry_profile_settings for select to authenticated
using (exists (select 1 from public.company_members m where m.company_id=industry_profile_settings.company_id and m.user_id=(select auth.uid()) and m.status='active'));
drop policy if exists "Company managers can insert industry settings" on public.industry_profile_settings;
create policy "Company managers can insert industry settings" on public.industry_profile_settings for insert to authenticated
with check (updated_by=(select auth.uid()) and exists (select 1 from public.company_members m where m.company_id=industry_profile_settings.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','manager')));
drop policy if exists "Company managers can update industry settings" on public.industry_profile_settings;
create policy "Company managers can update industry settings" on public.industry_profile_settings for update to authenticated
using (exists (select 1 from public.company_members m where m.company_id=industry_profile_settings.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','manager')))
with check (updated_by=(select auth.uid()) and exists (select 1 from public.company_members m where m.company_id=industry_profile_settings.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','manager')));
drop policy if exists "Company managers can delete industry settings" on public.industry_profile_settings;
create policy "Company managers can delete industry settings" on public.industry_profile_settings for delete to authenticated
using (exists (select 1 from public.company_members m where m.company_id=industry_profile_settings.company_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','manager')));
