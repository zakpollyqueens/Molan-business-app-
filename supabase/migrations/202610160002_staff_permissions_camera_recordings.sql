-- Granular staff access and private CCTV recording catalogue.
-- Live playback/recording ingestion must be provided by a supported camera vendor or secure recorder relay.
create table if not exists public.company_member_permissions (
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  member_user_id uuid not null,
  permission_key text not null check (permission_key in (
    'staff.view','staff.invite','staff.manage','staff.permissions.assign',
    'camera.view','camera.manage',
    'marketing.view','marketing.manage',
    'customers.view','customers.manage',
    'inventory.view','inventory.manage',
    'sales.view','sales.manage',
    'finance.view','finance.manage',
    'reports.view','reports.manage',
    'operations.view','operations.manage'
  )),
  granted boolean not null default true,
  granted_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, member_user_id, permission_key),
  foreign key (company_id, member_user_id)
    references public.company_members(company_id, user_id) on delete cascade,
  foreign key (company_id, granted_by)
    references public.company_members(company_id, user_id) on delete cascade
);

create index if not exists company_member_permissions_member_idx
  on public.company_member_permissions(company_id, member_user_id, granted)
  where granted = true;

create or replace function public.has_company_permission(target_company uuid, target_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and cm.role = 'owner'
  ) or exists (
    select 1
    from public.company_members cm
    join public.company_member_permissions p
      on p.company_id = cm.company_id and p.member_user_id = cm.user_id
    where cm.company_id = target_company
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and p.permission_key = target_permission
      and p.granted = true
  );
$$;

alter table public.company_member_permissions enable row level security;
drop policy if exists "Members read own granted permissions or staff managers read all" on public.company_member_permissions;
create policy "Members read own granted permissions or staff managers read all"
on public.company_member_permissions for select to authenticated
using (
  member_user_id = (select auth.uid())
  or public.has_company_permission(company_id, 'staff.view')
  or public.has_company_permission(company_id, 'staff.permissions.assign')
);

drop policy if exists "Authorized managers grant delegated permissions" on public.company_member_permissions;
create policy "Authorized managers grant delegated permissions"
on public.company_member_permissions for insert to authenticated
with check (
  public.has_company_permission(company_id, 'staff.permissions.assign')
  and (
    public.has_company_permission(company_id, 'staff.permissions.assign')
    and (
      exists (
        select 1 from public.company_members owner_member
        where owner_member.company_id = company_member_permissions.company_id
          and owner_member.user_id = (select auth.uid())
          and owner_member.role = 'owner'
          and owner_member.status = 'active'
      )
      or public.has_company_permission(company_id, permission_key)
    )
  )
  and granted_by = (select auth.uid())
);

drop policy if exists "Authorized managers update delegated permissions" on public.company_member_permissions;
create policy "Authorized managers update delegated permissions"
on public.company_member_permissions for update to authenticated
using (
  public.has_company_permission(company_id, 'staff.permissions.assign')
  and (
    exists (
      select 1 from public.company_members owner_member
      where owner_member.company_id = company_member_permissions.company_id
        and owner_member.user_id = (select auth.uid())
        and owner_member.role = 'owner'
        and owner_member.status = 'active'
    )
    or public.has_company_permission(company_id, permission_key)
  )
)
with check (
  public.has_company_permission(company_id, 'staff.permissions.assign')
  and (
    exists (
      select 1 from public.company_members owner_member
      where owner_member.company_id = company_member_permissions.company_id
        and owner_member.user_id = (select auth.uid())
        and owner_member.role = 'owner'
        and owner_member.status = 'active'
    )
    or public.has_company_permission(company_id, permission_key)
  )
);

drop policy if exists "Authorized managers revoke delegated permissions" on public.company_member_permissions;
create policy "Authorized managers revoke delegated permissions"
on public.company_member_permissions for delete to authenticated
using (
  public.has_company_permission(company_id, 'staff.permissions.assign')
  and (
    exists (
      select 1 from public.company_members owner_member
      where owner_member.company_id = company_member_permissions.company_id
        and owner_member.user_id = (select auth.uid())
        and owner_member.role = 'owner'
        and owner_member.status = 'active'
    )
    or public.has_company_permission(company_id, permission_key)
  )
);

-- Recordings are metadata pointers to objects in a PRIVATE storage bucket.
-- Never store camera credentials or expose permanent public playback URLs here.
create table if not exists public.business_camera_recordings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  camera_id uuid not null references public.business_cameras(id) on delete cascade,
  recording_started_at timestamptz not null,
  recording_ended_at timestamptz,
  storage_bucket text not null default 'private-camera-recordings',
  storage_path text not null,
  source text not null default 'camera_provider'
    check (source in ('camera_provider','secure_recorder_relay','uploaded_clip')),
  status text not null default 'available'
    check (status in ('processing','available','failed','deleted')),
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  check (recording_ended_at is null or recording_ended_at >= recording_started_at),
  unique (storage_bucket, storage_path),
  foreign key (company_id, camera_id)
    references public.business_cameras(company_id, id) on delete cascade
);

create index if not exists business_camera_recordings_timeline_idx
  on public.business_camera_recordings(company_id, camera_id, recording_started_at desc)
  where status = 'available';

alter table public.business_camera_recordings enable row level security;
drop policy if exists "Authorized camera viewers read recording catalogue" on public.business_camera_recordings;
create policy "Authorized camera viewers read recording catalogue"
on public.business_camera_recordings for select to authenticated
using (
  public.has_company_permission(company_id, 'camera.view')
  and exists (
    select 1 from public.business_cameras c
    where c.id = business_camera_recordings.camera_id
      and c.company_id = business_camera_recordings.company_id
      and c.status <> 'disabled'
  )
);
drop policy if exists "Camera managers add recording metadata" on public.business_camera_recordings;
create policy "Camera managers add recording metadata"
on public.business_camera_recordings for insert to authenticated
with check (
  public.has_company_permission(company_id, 'camera.manage')
  and created_by = (select auth.uid())
);
drop policy if exists "Camera managers update recording metadata" on public.business_camera_recordings;
create policy "Camera managers update recording metadata"
on public.business_camera_recordings for update to authenticated
using (public.has_company_permission(company_id, 'camera.manage'))
with check (public.has_company_permission(company_id, 'camera.manage'));
drop policy if exists "Camera managers delete recording metadata" on public.business_camera_recordings;
drop policy if exists "Only business owner deletes recording metadata" on public.business_camera_recordings;
create policy "Only business owner deletes recording metadata"
on public.business_camera_recordings for delete to authenticated
using (
  exists (
    select 1 from public.company_members owner_member
    where owner_member.company_id = business_camera_recordings.company_id
      and owner_member.user_id = (select auth.uid())
      and owner_member.role = 'owner'
      and owner_member.status = 'active'
  )
);

-- Replace broad owner/admin camera policies with the new explicit camera permissions.
drop policy if exists "Workspace owners and admins read connected cameras" on public.business_cameras;
drop policy if exists "Workspace owners and admins add connected cameras" on public.business_cameras;
drop policy if exists "Workspace owners and admins update connected cameras" on public.business_cameras;
drop policy if exists "Workspace owners and admins delete connected cameras" on public.business_cameras;
create policy "Explicit camera viewers read connected cameras"
on public.business_cameras for select to authenticated
using (public.has_company_permission(company_id, 'camera.view'));
create policy "Explicit camera managers add connected cameras"
on public.business_cameras for insert to authenticated
with check (
  public.has_company_permission(company_id, 'camera.manage')
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.business_locations l
    where l.id = business_cameras.location_id and l.company_id = business_cameras.company_id
  )
);
create policy "Explicit camera managers update connected cameras"
on public.business_cameras for update to authenticated
using (public.has_company_permission(company_id, 'camera.manage'))
with check (public.has_company_permission(company_id, 'camera.manage'));
create policy "Explicit camera managers delete connected cameras"
on public.business_cameras for delete to authenticated
using (public.has_company_permission(company_id, 'camera.manage'));

drop policy if exists "Workspace owners and admins read connected locations" on public.business_locations;
drop policy if exists "Workspace owners and admins add connected locations" on public.business_locations;
drop policy if exists "Workspace owners and admins update connected locations" on public.business_locations;
drop policy if exists "Workspace owners and admins delete connected locations" on public.business_locations;
create policy "Explicit camera viewers read connected locations"
on public.business_locations for select to authenticated
using (public.has_company_permission(company_id, 'camera.view'));
create policy "Explicit camera managers add connected locations"
on public.business_locations for insert to authenticated
with check (public.has_company_permission(company_id, 'camera.manage') and created_by = (select auth.uid()));
create policy "Explicit camera managers update connected locations"
on public.business_locations for update to authenticated
using (public.has_company_permission(company_id, 'camera.manage'))
with check (public.has_company_permission(company_id, 'camera.manage'));
create policy "Explicit camera managers delete connected locations"
on public.business_locations for delete to authenticated
using (public.has_company_permission(company_id, 'camera.manage'));

-- Owner always has all access. Seed no permissions for staff: the owner must grant each permission explicitly.

-- Private bucket for recording segments. Recording ingestion is performed by a trusted provider/relay,
-- never by granting browser clients unrestricted access to storage.
insert into storage.buckets (id, name, public)
values ('private-camera-recordings', 'private-camera-recordings', false)
on conflict (id) do update set public = false;

drop policy if exists "Authorized staff read private camera recordings" on storage.objects;
create policy "Authorized staff read private camera recordings"
on storage.objects for select to authenticated
using (
  bucket_id = 'private-camera-recordings'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'camera.view')
);

drop policy if exists "Only business owner deletes private camera recordings" on storage.objects;
create policy "Only business owner deletes private camera recordings"
on storage.objects for delete to authenticated
using (
  bucket_id = 'private-camera-recordings'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.company_members owner_member
    where owner_member.company_id = ((storage.foldername(name))[1])::uuid
      and owner_member.user_id = (select auth.uid())
      and owner_member.role = 'owner'
      and owner_member.status = 'active'
  )
);

drop policy if exists "Camera manager uploads recordings" on storage.objects;
create policy "Camera manager uploads recordings"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-camera-recordings'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'camera.manage')
);

drop policy if exists "Camera manager updates recordings" on storage.objects;
create policy "Camera manager updates recordings"
on storage.objects for update to authenticated
using (
  bucket_id = 'private-camera-recordings'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'camera.manage')
)
with check (
  bucket_id = 'private-camera-recordings'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'camera.manage')
);
