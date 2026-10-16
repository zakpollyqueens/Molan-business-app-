-- Private credentials and short-lived sessions for the read-only member portal.
create table public.sacco_member_portal_credentials (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 member_id uuid not null,
 pin_salt text,
 pin_hash text,
 enrollment_code_hash text,
 enrollment_expires_at timestamptz,
 failed_attempts integer not null default 0 check (failed_attempts between 0 and 100),
 locked_until timestamptz,
 last_login_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(company_id,member_id),
 foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete cascade,
 check ((pin_salt is null and pin_hash is null) or (pin_salt is not null and pin_hash is not null))
);
create table public.sacco_member_portal_sessions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 member_id uuid not null,
 token_hash text not null unique,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete cascade
);
create index sacco_member_portal_sessions_member_idx on public.sacco_member_portal_sessions(company_id,member_id,expires_at);
create table public.sacco_member_portal_attempts (
 lookup_hash text primary key,
 attempts integer not null default 0 check (attempts between 0 and 100),
 window_started_at timestamptz not null default now(),
 locked_until timestamptz,
 updated_at timestamptz not null default now()
);
create table public.sacco_member_portal_preferences (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null,
 member_id uuid not null,
 preferences jsonb not null default '{"theme":"glass","wallpaper":"midnight","font_style":"system","display_density":"comfortable"}'::jsonb check (jsonb_typeof(preferences)='object'),
 updated_at timestamptz not null default now(),
 unique(company_id,member_id),
 foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete cascade
);
alter table public.sacco_member_portal_credentials enable row level security;
alter table public.sacco_member_portal_sessions enable row level security;
alter table public.sacco_member_portal_attempts enable row level security;
alter table public.sacco_member_portal_preferences enable row level security;
revoke all on public.sacco_member_portal_credentials, public.sacco_member_portal_sessions, public.sacco_member_portal_attempts, public.sacco_member_portal_preferences from anon, authenticated;
grant all on public.sacco_member_portal_credentials, public.sacco_member_portal_sessions, public.sacco_member_portal_attempts, public.sacco_member_portal_preferences to service_role;