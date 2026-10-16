-- Initial SACCO tables and RLS. Later numbered migrations harden tenant keys and withdrawal concurrency.
create table public.sacco_role_assignments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('analyst','secretary','mobilizer','chairperson')),
 assigned_by uuid references auth.users(id), created_at timestamptz not null default now(), unique(company_id,user_id,role)
);
create table public.sacco_terms (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 term_name text not null check(length(trim(term_name)) between 2 and 100), starts_on date not null, ends_on date not null,
 reconciliation_schedule text not null default 'monthly' check(reconciliation_schedule in ('daily','weekly','monthly')),
 status text not null default 'planned' check(status in ('planned','active','completed','archived')),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), check(ends_on>=starts_on), unique(company_id,term_name,starts_on)
);
create table public.sacco_members (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 account_code text not null check(length(trim(account_code)) between 2 and 40), full_name text not null check(length(trim(full_name)) between 2 and 180),
 phone text, email text, avatar_url text, portal_user_id uuid references auth.users(id) on delete set null,
 joined_on date not null default (now() at time zone 'Africa/Kampala')::date,
 status text not null default 'active' check(status in ('active','inactive','exited')), notes text,
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(company_id,account_code)
);
create table public.sacco_withdrawal_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid not null references public.sacco_members(id) on delete restrict, term_id uuid references public.sacco_terms(id) on delete restrict,
 amount numeric(14,2) not null check(amount>0), payment_method text not null default 'cash' check(payment_method in ('cash','mobile_money','bank','card','other')),
 channel text not null default 'online' check(channel in ('online','offline')),
 status text not null default 'pending' check(status in ('pending','approved','rejected','paid')),
 request_note text, rejection_reason text, requested_by uuid not null default auth.uid() references auth.users(id), requested_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, approved_amount numeric(14,2), paid_amount numeric(14,2),
 paid_by uuid references auth.users(id), paid_at timestamptz, payment_reference text, payment_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.sacco_savings_entries (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid not null references public.sacco_members(id) on delete restrict, term_id uuid references public.sacco_terms(id) on delete restrict,
 withdrawal_request_id uuid references public.sacco_withdrawal_requests(id) on delete restrict,
 entry_type text not null default 'deposit' check(entry_type in ('deposit','withdrawal','adjustment')),
 amount numeric(14,2) not null check(amount>0), transaction_date date not null default (now() at time zone 'Africa/Kampala')::date,
 payment_method text not null default 'cash' check(payment_method in ('cash','mobile_money','bank','card','other')),
 channel text not null default 'online' check(channel in ('online','offline')), reference text, notes text,
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','reversed')),
 submitted_by uuid not null default auth.uid() references auth.users(id), submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, rejection_reason text, idempotency_key text,
 created_at timestamptz not null default now(), unique(company_id,idempotency_key)
);
create table public.sacco_member_reviews (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid not null references public.sacco_members(id) on delete cascade, term_id uuid references public.sacco_terms(id) on delete restrict,
 review_type text not null default 'general' check(review_type in ('general','term_end')),
 message text not null check(length(trim(message)) between 2 and 3000),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
create index sacco_members_company_name_idx on public.sacco_members(company_id,full_name);
create index sacco_members_portal_user_idx on public.sacco_members(portal_user_id) where portal_user_id is not null;
create index sacco_terms_company_dates_idx on public.sacco_terms(company_id,starts_on,ends_on);
create index sacco_savings_company_member_date_idx on public.sacco_savings_entries(company_id,member_id,transaction_date desc);
create index sacco_savings_pending_idx on public.sacco_savings_entries(company_id,status,submitted_at desc);
create index sacco_withdrawals_dashboard_idx on public.sacco_withdrawal_requests(company_id,status,requested_at desc);
create index sacco_reviews_member_idx on public.sacco_member_reviews(company_id,member_id,created_at desc);
alter table public.sacco_role_assignments enable row level security;
alter table public.sacco_terms enable row level security;
alter table public.sacco_members enable row level security;
alter table public.sacco_savings_entries enable row level security;
alter table public.sacco_withdrawal_requests enable row level security;
alter table public.sacco_member_reviews enable row level security;
create policy sacco_roles_read_member on public.sacco_role_assignments for select to authenticated using(public.is_company_member(company_id) or user_id=(select auth.uid()));
create policy sacco_roles_manage_admin on public.sacco_role_assignments for all to authenticated using(public.has_company_role(company_id,array['owner','admin']::text[])) with check(public.has_company_role(company_id,array['owner','admin']::text[]));
create policy sacco_terms_read on public.sacco_terms for select to authenticated using(public.is_company_member(company_id));
create policy sacco_terms_manage on public.sacco_terms for all to authenticated using(public.has_company_role(company_id,array['owner','admin','manager']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_terms.company_id and r.user_id=(select auth.uid()) and r.role='chairperson')) with check(public.has_company_role(company_id,array['owner','admin','manager']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_terms.company_id and r.user_id=(select auth.uid()) and r.role='chairperson'));
create policy sacco_members_read on public.sacco_members for select to authenticated using(public.is_company_member(company_id) or portal_user_id=(select auth.uid()));
create policy sacco_members_insert_staff on public.sacco_members for insert to authenticated with check(created_by=(select auth.uid()) and (public.has_company_role(company_id,array['owner','admin','manager']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_members.company_id and r.user_id=(select auth.uid()) and r.role in ('analyst','secretary','mobilizer','chairperson'))));
create policy sacco_members_update_admin_analyst on public.sacco_members for update to authenticated using(public.has_company_role(company_id,array['owner','admin']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_members.company_id and r.user_id=(select auth.uid()) and r.role in ('analyst','chairperson'))) with check(public.has_company_role(company_id,array['owner','admin']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_members.company_id and r.user_id=(select auth.uid()) and r.role in ('analyst','chairperson')));
create policy sacco_savings_read on public.sacco_savings_entries for select to authenticated using(public.is_company_member(company_id) or exists(select 1 from public.sacco_members m where m.id=sacco_savings_entries.member_id and m.portal_user_id=(select auth.uid())));
create policy sacco_savings_submit_pending_deposit on public.sacco_savings_entries for insert to authenticated with check(entry_type='deposit' and status='pending' and reviewed_by is null and reviewed_at is null and submitted_by=(select auth.uid()) and public.is_company_member(company_id) and (public.has_company_role(company_id,array['owner','admin','manager','accountant']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_savings_entries.company_id and r.user_id=(select auth.uid()) and r.role in ('analyst','secretary','mobilizer'))));
create policy sacco_withdrawals_read on public.sacco_withdrawal_requests for select to authenticated using(public.is_company_member(company_id) or exists(select 1 from public.sacco_members m where m.id=sacco_withdrawal_requests.member_id and m.portal_user_id=(select auth.uid())));
create policy sacco_withdrawals_submit on public.sacco_withdrawal_requests for insert to authenticated with check(status='pending' and reviewed_by is null and paid_at is null and paid_by is null and requested_by=(select auth.uid()) and (exists(select 1 from public.sacco_members m where m.id=sacco_withdrawal_requests.member_id and m.portal_user_id=(select auth.uid())) or (public.is_company_member(company_id) and (public.has_company_role(company_id,array['owner','admin','manager','accountant']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_withdrawal_requests.company_id and r.user_id=(select auth.uid()) and r.role in ('analyst','secretary','mobilizer'))))));
create policy sacco_reviews_read on public.sacco_member_reviews for select to authenticated using(public.is_company_member(company_id) or exists(select 1 from public.sacco_members m where m.id=sacco_member_reviews.member_id and m.portal_user_id=(select auth.uid())));
create policy sacco_reviews_chairperson_insert on public.sacco_member_reviews for insert to authenticated with check(created_by=(select auth.uid()) and public.is_company_member(company_id) and exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_member_reviews.company_id and r.user_id=(select auth.uid()) and r.role='chairperson'));
grant select,insert,update on public.sacco_role_assignments,public.sacco_terms,public.sacco_members,public.sacco_savings_entries,public.sacco_withdrawal_requests,public.sacco_member_reviews to authenticated;
revoke delete on public.sacco_savings_entries,public.sacco_withdrawal_requests from authenticated;
