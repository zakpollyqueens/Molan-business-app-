-- SACCO welfare-account loans and dated repayment ledger.
alter table public.sacco_welfare_entries drop constraint if exists sacco_welfare_entries_entry_type_check;
alter table public.sacco_welfare_entries add constraint sacco_welfare_entries_entry_type_check
 check (entry_type in ('contribution','disbursement','adjustment','loan_disbursement','loan_principal_repayment','loan_interest_income','other_income','expense'));

create table if not exists public.sacco_welfare_loans (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid not null,
 principal numeric(14,2) not null check(principal>0),
 requested_on date not null default (now() at time zone 'Africa/Kampala')::date,
 expected_repayment_date date not null,
 status text not null default 'pending' check(status in ('pending','issued','rejected','repaid')),
 purpose text not null default '',
 payment_method text check(payment_method in ('cash','mobile_money','bank','card','other')),
 disbursed_on date, disbursed_by uuid references auth.users(id),
 recorded_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id), rejection_reason text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), unique(company_id,id),
 constraint sacco_welfare_loans_member_company_fkey foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete restrict,
 check(expected_repayment_date >= requested_on),
 check((status <> 'issued' and status <> 'repaid') or disbursed_on is not null)
);
create table if not exists public.sacco_welfare_loan_repayments (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.company_profiles(id) on delete cascade,
 loan_id uuid not null, amount_paid numeric(14,2) not null check(amount_paid>0),
 actual_repayment_date date not null, recorded_at timestamptz not null default now(),
 payment_method text not null check(payment_method in ('cash','mobile_money','bank','card','other')),
 reference text, notes text, interest_due_at_payment numeric(14,2) not null default 0,
 interest_paid numeric(14,2) not null default 0, principal_paid numeric(14,2) not null default 0,
 recorded_by uuid not null default auth.uid() references auth.users(id), unique(company_id,id),
 constraint sacco_welfare_repayments_loan_company_fkey foreign key(company_id,loan_id) references public.sacco_welfare_loans(company_id,id) on delete restrict
);
create index if not exists sacco_welfare_loans_company_status_idx on public.sacco_welfare_loans(company_id,status,expected_repayment_date);
create index if not exists sacco_welfare_repayments_loan_date_idx on public.sacco_welfare_loan_repayments(company_id,loan_id,actual_repayment_date,recorded_at);
alter table public.sacco_welfare_loans enable row level security;
alter table public.sacco_welfare_loan_repayments enable row level security;
grant select on public.sacco_welfare_loans, public.sacco_welfare_loan_repayments to authenticated;
drop policy if exists sacco_welfare_loans_read on public.sacco_welfare_loans;
create policy sacco_welfare_loans_read on public.sacco_welfare_loans for select to authenticated using(public.is_company_member(company_id));
drop policy if exists sacco_welfare_repayments_read on public.sacco_welfare_loan_repayments;
create policy sacco_welfare_repayments_read on public.sacco_welfare_loan_repayments for select to authenticated using(public.is_company_member(company_id));

create or replace function public.sacco_welfare_is_recorder(p_company_id uuid)
returns boolean language sql stable security invoker set search_path=pg_catalog,public as $$
 select public.has_company_role(p_company_id,array['owner','admin','manager','accountant']::text[])
 or exists(select 1 from public.sacco_role_assignments r where r.company_id=p_company_id and r.user_id=(select auth.uid()) and r.role in ('secretary','analyst','mobilizer'))
$$;
revoke all on function public.sacco_welfare_is_recorder(uuid) from public,anon;
grant execute on function public.sacco_welfare_is_recorder(uuid) to authenticated;

create or replace function public.sacco_welfare_create_loan_request(p_member_id uuid,p_principal numeric,p_expected_repayment_date date,p_purpose text default '')
returns public.sacco_welfare_loans language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v public.sacco_welfare_loans; v_company uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select company_id into v_company from public.sacco_members where id=p_member_id;
 if not public.sacco_welfare_is_recorder(v_company) then raise exception 'Secretary, analyst, mobilizer or authorized finance staff required'; end if;
 if p_principal<=0 or p_expected_repayment_date is null then raise exception 'Enter a positive loan amount and expected repayment date'; end if;
 insert into public.sacco_welfare_loans(company_id,member_id,principal,requested_on,expected_repayment_date,purpose,created_by)
 select m.company_id,m.id,p_principal,(now() at time zone 'Africa/Kampala')::date,p_expected_repayment_date,left(coalesce(p_purpose,''),1000),auth.uid()
 from public.sacco_members m where m.id=p_member_id and m.status='active'
 returning * into v;
 if not found then raise exception 'Active registered member not found'; end if;
 return v;
end $$;

create or replace function public.sacco_welfare_issue_loan(p_loan_id uuid,p_decision text,p_payment_method text default 'cash',p_reason text default null)
returns public.sacco_welfare_loans language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v public.sacco_welfare_loans; bal numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v from public.sacco_welfare_loans where id=p_loan_id for update;
 if not found then raise exception 'Loan request not found'; end if;
 if not public.sacco_welfare_is_recorder(v.company_id) then raise exception 'Authorized welfare-account staff required'; end if;
 if p_decision not in ('issue','reject') then raise exception 'Decision must be issue or reject'; end if;
 if v.status<>'pending' then raise exception 'Only pending loan requests can be processed'; end if;
 if p_decision='reject' then
  if length(trim(coalesce(p_reason,'')))<2 then raise exception 'A rejection reason is required'; end if;
  update public.sacco_welfare_loans set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=left(trim(p_reason),1000) where id=v.id returning * into v;
  return v;
 end if;
 if p_payment_method not in ('cash','mobile_money','bank','card','other') then raise exception 'Unsupported payment method'; end if;
 select coalesce(sum(case when status='confirmed' then
   case when entry_type in ('contribution','other_income','loan_interest_income','loan_principal_repayment') then amount
        when entry_type in ('disbursement','loan_disbursement','expense') then -amount else 0 end else 0 end),0)
 into bal from public.sacco_welfare_entries where company_id=v.company_id;
 if bal<v.principal then raise exception 'Insufficient available welfare-account balance to disburse this loan'; end if;
 update public.sacco_welfare_loans set status='issued',disbursed_on=(now() at time zone 'Africa/Kampala')::date,disbursed_by=auth.uid(),payment_method=p_payment_method,reviewed_by=auth.uid(),reviewed_at=now() where id=v.id returning * into v;
 insert into public.sacco_welfare_entries(company_id,member_id,entry_type,amount,transaction_date,payment_method,reference,notes,status,created_by,reviewed_by,reviewed_at)
 values(v.company_id,v.member_id,'loan_disbursement',v.principal,v.disbursed_on,p_payment_method,'WELFARE-LOAN:'||v.id,'Loan principal disbursed','confirmed',auth.uid(),auth.uid(),now());
 return v;
end $$;
revoke all on function public.sacco_welfare_create_loan_request(uuid,numeric,date,text) from public,anon;
revoke all on function public.sacco_welfare_issue_loan(uuid,text,text,text) from public,anon;
grant execute on function public.sacco_welfare_create_loan_request(uuid,numeric,date,text) to authenticated;
grant execute on function public.sacco_welfare_issue_loan(uuid,text,text,text) to authenticated;
