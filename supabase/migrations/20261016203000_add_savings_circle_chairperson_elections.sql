create table if not exists public.sacco_elections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','open','closed','cancelled')),
  created_by uuid not null references auth.users(id),
  closed_at timestamptz,
  winner_member_id uuid references public.sacco_members(id) on delete set null,
  winner_votes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sacco_elections_valid_window check (ends_at > starts_at)
);

create table if not exists public.sacco_election_candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  election_id uuid not null references public.sacco_elections(id) on delete cascade,
  member_id uuid not null references public.sacco_members(id) on delete cascade,
  nominated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (election_id, member_id)
);

create table if not exists public.sacco_election_votes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  election_id uuid not null references public.sacco_elections(id) on delete cascade,
  voter_member_id uuid not null references public.sacco_members(id) on delete cascade,
  candidate_id uuid not null references public.sacco_election_candidates(id) on delete cascade,
  cast_at timestamptz not null default now(),
  unique (election_id, voter_member_id)
);

create index if not exists sacco_elections_company_status_idx on public.sacco_elections(company_id, status, starts_at, ends_at);
create index if not exists sacco_election_candidates_election_idx on public.sacco_election_candidates(election_id, company_id);
create index if not exists sacco_election_votes_election_idx on public.sacco_election_votes(election_id, company_id);

alter table public.sacco_elections enable row level security;
alter table public.sacco_election_candidates enable row level security;
alter table public.sacco_election_votes enable row level security;

revoke all on public.sacco_elections, public.sacco_election_candidates, public.sacco_election_votes from public, anon, authenticated;
grant all on public.sacco_elections, public.sacco_election_candidates, public.sacco_election_votes to service_role;
