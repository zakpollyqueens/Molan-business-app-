-- Connected business locations and camera registry, isolated by parent company.
-- Camera credentials are intentionally not stored. Pairing payloads are hashed.
create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  business_type text not null check (length(trim(business_type)) between 1 and 120),
  address text,
  owner_reference text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_locations_company_idx on public.business_locations(company_id, created_at desc);

create table if not exists public.business_cameras (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  location_id uuid not null references public.business_locations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  provider text not null check (length(trim(provider)) between 1 and 80),
  camera_ref text,
  stream_url text,
  pairing_code_hash text,
  pairing_code_salt text,
  status text not null default 'registered' check (status in ('registered','viewer_configured','pairing_pending','connected','disabled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_camera_https_only check (stream_url is null or stream_url ~ '^https://')
);
create index if not exists business_cameras_company_idx on public.business_cameras(company_id, created_at desc);
create index if not exists business_cameras_location_idx on public.business_cameras(location_id);

alter table public.business_locations enable row level security;
alter table public.business_cameras enable row level security;
grant select, insert, update, delete on public.business_locations to authenticated;
grant select, insert, update, delete on public.business_cameras to authenticated;

create policy "Active workspace members manage connected locations"
on public.business_locations for all to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_locations.company_id
    and m.user_id = auth.uid() and m.status = 'active' and m.role = 'owner'
))
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.company_members m
    where m.company_id = business_locations.company_id
      and m.user_id = auth.uid() and m.status = 'active' and m.role = 'owner'
  )
);

create policy "Active workspace members manage connected cameras"
on public.business_cameras for all to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_cameras.company_id
    and m.user_id = auth.uid() and m.status = 'active' and m.role = 'owner'
))
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.company_members m
    where m.company_id = business_cameras.company_id
      and m.user_id = auth.uid() and m.status = 'active' and m.role = 'owner'
  )
  and exists (
    select 1 from public.business_locations l
    where l.id = business_cameras.location_id
      and l.company_id = business_cameras.company_id
  )
);
