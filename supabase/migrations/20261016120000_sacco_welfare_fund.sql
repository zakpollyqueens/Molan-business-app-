-- Separate SACCO welfare-fund ledger and request approval/payment workflow.
-- Welfare transactions are deliberately separate from personal member savings.
create table if not exists public.sacco_welfare_requests (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid,
 request_type text not null default 'emergency' check (request_type in ('medical','bereavement','emergency','education','other')),
 amount numeric(14,2) not null check (amount > 0),
 reason text not null check (length(trim(reason)) between 3 and 3000),
 status text not null default 'pending' check (status in ('pending','approved','rejected','paid')),
 requested_by uuid not null default auth.uid() references auth.users(id),
 requested_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 rejection_reason text,
 paid_by uuid references auth.users(id),
 paid_at timestamptz,
 payment_method text check (payment_method in ('cash','mobile_money','bank','card','other')),
 payment_reference text,
 payment_note text,
 created_at timestamptz not null default now(),
 unique(company_id,id),
 constraint sacco_welfare_requests_member_company_fkey
   foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete restrict
);
create table if not exists public.sacco_welfare_entries (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid,
 request_id uuid,
 entry_type text not null check (entry_type in ('contribution','disbursement','adjustment')),
 amount numeric(14,2) not null check (amount > 0),
 transaction_date date not null default (now() at time zone 'Africa/Kampala')::date,
 payment_method text not null default 'cash' check (payment_method in ('cash','mobile_money','bank','card','other')),
 reference text,
 notes text,
 status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
 created_by uuid not null default auth.uid() references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 rejection_reason text,
 created_at timestamptz not null default now(),
 unique(company_id,id),
 constraint sacco_welfare_entries_member_company_fkey
   foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete restrict,
 constraint sacco_welfare_entries_request_company_fkey
   foreign key(company_id,request_id) references public.sacco_welfare_requests(company_id,id) on delete restrict,
 constraint sacco_welfare_disbursement_requires_request
   check (entry_type <> 'disbursement' or request_id is not null)
);
create unique index if not exists sacco_welfare_one_disbursement_per_request
 on public.sacco_welfare_entries(company_id,request_id)
 where entry_type='disbursement' and status='confirmed';
create index if not exists sacco_welfare_requests_company_status_idx
 on public.sacco_welfare_requests(company_id,status,requested_at desc);
create index if not exists sacco_welfare_entries_company_date_idx
 on public.sacco_welfare_entries(company_id,transaction_date desc);

alter table public.sacco_welfare_requests enable row level security;
alter table public.sacco_welfare_entries enable row level security;
grant select,insert on public.sacco_welfare_requests to authenticated;
grant select,insert on public.sacco_welfare_entries to authenticated;

create policy sacco_welfare_requests_read on public.sacco_welfare_requests
 for select to authenticated using (
  public.is_company_member(company_id)
  or exists(select 1 from public.sacco_members m where m.company_id=sacco_welfare_requests.company_id and m.id=sacco_welfare_requests.member_id and m.portal_user_id=(select auth.uid()))
 );
create policy sacco_welfare_requests_submit on public.sacco_welfare_requests
 for insert to authenticated with check (
  requested_by=(select auth.uid()) and status='pending' and reviewed_by is null and paid_by is null
  and (public.is_company_member(company_id)
   or exists(select 1 from public.sacco_members m where m.company_id=sacco_welfare_requests.company_id and m.id=sacco_welfare_requests.member_id and m.portal_user_id=(select auth.uid())))
 );
create policy sacco_welfare_entries_read on public.sacco_welfare_entries
 for select to authenticated using (
  public.is_company_member(company_id)
  or exists(select 1 from public.sacco_members m where m.company_id=sacco_welfare_entries.company_id and m.id=sacco_welfare_entries.member_id and m.portal_user_id=(select auth.uid()))
 );
create policy sacco_welfare_contribution_record on public.sacco_welfare_entries
 for insert to authenticated with check (
  entry_type='contribution' and status='confirmed' and created_by=(select auth.uid())
  and reviewed_by=(select auth.uid()) and reviewed_at is not null
  and (public.has_company_role(company_id,array['owner','admin','manager','accountant']::text[])
   or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_welfare_entries.company_id and r.user_id=(select auth.uid()) and r.role in ('chairperson','secretary')))
 );

create or replace function public.sacco_review_welfare_request(
 p_request_id uuid, p_decision text, p_rejection_reason text default null
) returns public.sacco_welfare_requests
 language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare req public.sacco_welfare_requests;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
 select * into req from public.sacco_welfare_requests where id=p_request_id for update;
 if not found then raise exception 'Welfare request not found'; end if;
 if not (public.has_company_role(req.company_id,array['owner','admin','manager','accountant']::text[])
   or exists(select 1 from public.sacco_role_assignments r where r.company_id=req.company_id and r.user_id=auth.uid() and r.role='chairperson')) then
  raise exception 'Chairperson or authorized management role required';
 end if;
 if req.status <> 'pending' then raise exception 'Only pending welfare requests can be reviewed'; end if;
 update public.sacco_welfare_requests set status=p_decision, reviewed_by=auth.uid(), reviewed_at=now(),
  rejection_reason=case when p_decision='rejected' then nullif(trim(p_rejection_reason),'') else null end
 where id=p_request_id returning * into req;
 return req;
end $$;

create or replace function public.sacco_record_welfare_payment(
 p_request_id uuid, p_payment_method text, p_payment_reference text default null, p_payment_note text default null
) returns public.sacco_welfare_entries
 language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
declare req public.sacco_welfare_requests; entry public.sacco_welfare_entries;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_payment_method not in ('cash','mobile_money','bank','card','other') then raise exception 'Unsupported payment method'; end if;
 select * into req from public.sacco_welfare_requests where id=p_request_id for update;
 if not found then raise exception 'Welfare request not found'; end if;
 if not (public.has_company_role(req.company_id,array['owner','admin','manager','accountant']::text[])
   or exists(select 1 from public.sacco_role_assignments r where r.company_id=req.company_id and r.user_id=auth.uid() and r.role='chairperson')) then
  raise exception 'Chairperson or authorized management role required';
 end if;
 if req.status <> 'approved' then raise exception 'Only approved welfare requests can be paid'; end if;
 insert into public.sacco_welfare_entries(company_id,member_id,request_id,entry_type,amount,transaction_date,payment_method,reference,notes,status,created_by,reviewed_by,reviewed_at)
 values(req.company_id,req.member_id,req.id,'disbursement',req.amount,(now() at time zone 'Africa/Kampala')::date,p_payment_method,nullif(trim(p_payment_reference),''),coalesce(nullif(trim(p_payment_note),''),'Welfare request disbursement'),'confirmed',auth.uid(),auth.uid(),now())
 returning * into entry;
 update public.sacco_welfare_requests set status='paid',paid_by=auth.uid(),paid_at=now(),payment_method=p_payment_method,
  payment_reference=nullif(trim(p_payment_reference),''),payment_note=nullif(trim(p_payment_note),'')
 where id=req.id;
 return entry;
end $$;

revoke all on function public.sacco_review_welfare_request(uuid,text,text) from public, anon;
revoke all on function public.sacco_record_welfare_payment(uuid,text,text,text) from public, anon;
grant execute on function public.sacco_review_welfare_request(uuid,text,text) to authenticated;
grant execute on function public.sacco_record_welfare_payment(uuid,text,text,text) to authenticated;
