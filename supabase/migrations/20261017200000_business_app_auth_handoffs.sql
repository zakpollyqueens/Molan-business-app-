-- Secure, short-lived browser-to-installed-app account handoffs.
begin;

create table if not exists public.business_app_auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  profile_slug text not null default '',
  target_device text not null check (target_device in ('mobile','pc')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists business_app_auth_handoffs_expiry_idx
  on public.business_app_auth_handoffs (expires_at);
create index if not exists business_app_auth_handoffs_user_created_idx
  on public.business_app_auth_handoffs (user_id, created_at desc);

alter table public.business_app_auth_handoffs enable row level security;
revoke all on table public.business_app_auth_handoffs from anon, authenticated;
grant all on table public.business_app_auth_handoffs to service_role;

commit;
