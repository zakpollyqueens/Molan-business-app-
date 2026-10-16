-- Globally unique, verified device claims prevent one camera identity from being bound to multiple business workspaces.
create table if not exists public.business_camera_device_claims (
  id uuid primary key default gen_random_uuid(),
  device_fingerprint_hash text not null unique,
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  camera_id uuid not null,
  provider text not null,
  verification_method text not null check (verification_method in ('vendor_oauth','onvif_challenge','nvr_authorization','vendor_pairing_token','trusted_relay')),
  verification_status text not null default 'verified' check (verification_status in ('pending','verified','revoked','failed')),
  verified_at timestamptz,
  claimed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id,camera_id) references public.business_cameras(company_id,id) on delete cascade,
  check ((verification_status <> 'verified') or verified_at is not null)
);
create index if not exists business_camera_device_claims_company_idx
  on public.business_camera_device_claims(company_id,verification_status);
alter table public.business_camera_device_claims enable row level security;
drop policy if exists "Authorized camera viewers read verified device claims" on public.business_camera_device_claims;
create policy "Authorized camera viewers read verified device claims"
on public.business_camera_device_claims for select to authenticated
using (public.has_company_permission(company_id,'camera.view'));
drop policy if exists "Only owner revokes camera device claims" on public.business_camera_device_claims;
create policy "Only owner revokes camera device claims"
on public.business_camera_device_claims for delete to authenticated
using (exists (
  select 1 from public.company_members m where m.company_id=business_camera_device_claims.company_id
    and m.user_id=(select auth.uid()) and m.role='owner' and m.status='active'
));
-- No authenticated INSERT or UPDATE policy: only a trusted integration may claim or reassign a device after proving ownership.
