-- Website service automated build queue and payment-gated publication.
create table if not exists public.website_service_build_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  request_id uuid not null unique references public.website_service_requests(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued','building','ready_for_final_payment','published','failed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  progress_message text not null default 'Your website request is queued.',
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists website_service_build_jobs_company_updated_idx
  on public.website_service_build_jobs(company_id, updated_at desc);

alter table public.website_service_build_jobs enable row level security;
revoke all on public.website_service_build_jobs from anon, authenticated;
grant select on public.website_service_build_jobs to authenticated;
grant all on public.website_service_build_jobs to service_role;
drop policy if exists "Company members view website build progress" on public.website_service_build_jobs;
create policy "Company members view website build progress"
  on public.website_service_build_jobs
  for select to authenticated
  using (private.is_company_member(company_id));

-- Build artifacts are never exposed through the Data API. Only service_role can access them.
create table if not exists public.website_service_build_artifacts (
  request_id uuid primary key references public.website_service_requests(id) on delete cascade,
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
alter table public.website_service_build_artifacts enable row level security;
revoke all on public.website_service_build_artifacts from anon, authenticated;
grant all on public.website_service_build_artifacts to service_role;

-- The private staging bucket contains generated HTML until the final payment is verified.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-service-builds', 'website-service-builds', false, 5242880, array['text/html'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['text/html'];

-- The public delivery bucket receives the final site only after the balance is verified.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-service-deliveries', 'website-service-deliveries', true, 5242880, array['text/html'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['text/html'];

drop policy if exists "Public read published website service deliveries" on storage.objects;
create policy "Public read published website service deliveries"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'website-service-deliveries');

comment on table public.website_service_build_jobs is
  'Customer-visible progress for website builds; generated artifacts remain private until final payment verification.';
comment on table public.website_service_build_artifacts is
  'Service-role-only pointer to private website HTML awaiting final payment and publication.';
