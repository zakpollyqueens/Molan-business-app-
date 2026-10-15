-- Molan Business SACCO foundation: member accounts, configurable terms, savings review, withdrawals.
-- Financial changes are append-only; approvals and payment posting are atomic, audited RPC operations.
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
 updated_at timestamptz not null default now(), check(ends_on>=starts_on), unique(company_id,term_name,starts_on), unique(company_id,id)
);
create table public.sacco_members (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 account_code text not null check(length(trim(account_code)) between 2 and 40), full_name text not null check(length(trim(full_name)) between 2 and 180),
 phone text, email text, avatar_url text, portal_user_id uuid references auth.users(id) on delete set null,
 joined_on date not null default (now() at time zone 'Africa/Kampala')::date,
 status text not null default 'active' check(status in ('active','inactive','exited')), notes text,
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(company_id,account_code), unique(company_id,id)
);
create table public.sacco_withdrawal_requests (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid not null, term_id uuid, amount numeric(14,2) not null check(amount>0),
 payment_method text not null default 'cash' check(payment_method in ('cash','mobile_money','bank','card','other')),
 channel text not null default 'online' check(channel in ('online','offline')),
 status text not null default 'pending' check(status in ('pending','approved','rejected','paid')),
 request_note text, rejection_reason text, requested_by uuid not null default auth.uid() references auth.users(id), requested_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, approved_amount numeric(14,2), paid_amount numeric(14,2),
 paid_by uuid references auth.users(id), paid_at timestamptz, payment_reference text, payment_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(company_id,id),
 foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete restrict,
 foreign key(company_id,term_id) references public.sacco_terms(company_id,id) on delete restrict
);
create table public.sacco_savings_entries (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid not null, term_id uuid, withdrawal_request_id uuid, entry_type text not null default 'deposit' check(entry_type in ('deposit','withdrawal','adjustment')),
 amount numeric(14,2) not null check(amount>0), transaction_date date not null default (now() at time zone 'Africa/Kampala')::date,
 payment_method text not null default 'cash' check(payment_method in ('cash','mobile_money','bank','card','other')),
 channel text not null default 'online' check(channel in ('online','offline')), reference text, notes text,
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','reversed')),
 submitted_by uuid not null default auth.uid() references auth.users(id), submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, rejection_reason text, idempotency_key text,
 created_at timestamptz not null default now(), unique(company_id,idempotency_key),
 foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete restrict,
 foreign key(company_id,term_id) references public.sacco_terms(company_id,id) on delete restrict,
 foreign key(company_id,withdrawal_request_id) references public.sacco_withdrawal_requests(company_id,id) on delete restrict
);
create table public.sacco_member_reviews (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.company_profiles(id) on delete cascade,
 member_id uuid not null, term_id uuid, review_type text not null default 'general' check(review_type in ('general','term_end')),
 message text not null check(length(trim(message)) between 2 and 3000),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete cascade,
 foreign key(company_id,term_id) references public.sacco_terms(company_id,id) on delete restrict
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
create policy sacco_savings_read on public.sacco_savings_entries for select to authenticated using(public.is_company_member(company_id) or exists(select 1 from public.sacco_members m where m.id=sacco_savings_entries.member_id and m.company_id=sacco_savings_entries.company_id and m.portal_user_id=(select auth.uid())));
create policy sacco_savings_submit_pending_deposit on public.sacco_savings_entries for insert to authenticated with check(entry_type='deposit' and status='pending' and reviewed_by is null and reviewed_at is null and submitted_by=(select auth.uid()) and public.is_company_member(company_id) and (public.has_company_role(company_id,array['owner','admin','manager','accountant']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_savings_entries.company_id and r.user_id=(select auth.uid()) and r.role in ('analyst','secretary','mobilizer'))));
create policy sacco_withdrawals_read on public.sacco_withdrawal_requests for select to authenticated using(public.is_company_member(company_id) or exists(select 1 from public.sacco_members m where m.id=sacco_withdrawal_requests.member_id and m.company_id=sacco_withdrawal_requests.company_id and m.portal_user_id=(select auth.uid())));
create policy sacco_withdrawals_submit on public.sacco_withdrawal_requests for insert to authenticated with check(status='pending' and reviewed_by is null and paid_at is null and paid_by is null and requested_by=(select auth.uid()) and (exists(select 1 from public.sacco_members m where m.id=sacco_withdrawal_requests.member_id and m.company_id=sacco_withdrawal_requests.company_id and m.portal_user_id=(select auth.uid())) or (public.is_company_member(company_id) and (public.has_company_role(company_id,array['owner','admin','manager','accountant']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_withdrawal_requests.company_id and r.user_id=(select auth.uid()) and r.role in ('analyst','secretary','mobilizer'))))));
create policy sacco_reviews_read on public.sacco_member_reviews for select to authenticated using(public.is_company_member(company_id) or exists(select 1 from public.sacco_members m where m.id=sacco_member_reviews.member_id and m.company_id=sacco_member_reviews.company_id and m.portal_user_id=(select auth.uid())));
create policy sacco_reviews_chairperson_insert on public.sacco_member_reviews for insert to authenticated with check(created_by=(select auth.uid()) and public.is_company_member(company_id) and exists(select 1 from public.sacco_role_assignments r where r.company_id=sacco_member_reviews.company_id and r.user_id=(select auth.uid()) and r.role='chairperson'));
grant select,insert,update,delete on public.sacco_role_assignments to authenticated;
grant select,insert,update on public.sacco_terms,public.sacco_members,public.sacco_savings_entries,public.sacco_withdrawal_requests,public.sacco_member_reviews to authenticated;
revoke delete on public.sacco_savings_entries,public.sacco_withdrawal_requests from authenticated;

create or replace function public.sacco_review_savings(p_entry_id uuid,p_decision text,p_reason text default null)
returns public.sacco_savings_entries language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.sacco_savings_entries;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_decision not in ('confirm','reject') then raise exception 'Decision must be confirm or reject'; end if;
 select e.* into v from public.sacco_savings_entries e where e.id=p_entry_id for update;
 if not found then raise exception 'Savings entry not found'; end if;
 if not (public.has_company_role(v.company_id,array['owner','admin']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=v.company_id and r.user_id=auth.uid() and r.role='chairperson')) then raise exception 'Only the chairperson or authorized company admin can review savings'; end if;
 if v.status<>'pending' or v.entry_type<>'deposit' then raise exception 'This entry is not awaiting review'; end if;
 if p_decision='reject' and length(trim(coalesce(p_reason,'')))<2 then raise exception 'A rejection reason is required'; end if;
 update public.sacco_savings_entries set status=case when p_decision='confirm' then 'confirmed' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_decision='reject' then left(trim(p_reason),1000) else null end where id=p_entry_id returning * into v;
 return v;
end $$;
revoke all on function public.sacco_review_savings(uuid,text,text) from public,anon;
grant execute on function public.sacco_review_savings(uuid,text,text) to authenticated;

create or replace function public.sacco_review_withdrawal(p_request_id uuid,p_decision text,p_reason text default null,p_approved_amount numeric default null)
returns public.sacco_withdrawal_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.sacco_withdrawal_requests; v_balance numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_decision not in ('approve','reject') then raise exception 'Decision must be approve or reject'; end if;
 select w.* into v from public.sacco_withdrawal_requests w where w.id=p_request_id for update;
 if not found then raise exception 'Withdrawal request not found'; end if;
 if not (public.has_company_role(v.company_id,array['owner','admin']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=v.company_id and r.user_id=auth.uid() and r.role='chairperson')) then raise exception 'Only the chairperson or authorized company admin can review withdrawals'; end if;
 if v.status<>'pending' then raise exception 'This withdrawal request has already been reviewed'; end if;
 select coalesce(sum(case when entry_type='deposit' then amount when entry_type='withdrawal' then -amount else 0 end),0) into v_balance from public.sacco_savings_entries where company_id=v.company_id and member_id=v.member_id and status='confirmed';
 if p_decision='approve' then
  if coalesce(p_approved_amount,v.amount)<=0 or coalesce(p_approved_amount,v.amount)>v.amount then raise exception 'Approved amount must be positive and cannot exceed the request'; end if;
  if coalesce(p_approved_amount,v.amount)>v_balance then raise exception 'Insufficient confirmed savings for this withdrawal'; end if;
 elsif length(trim(coalesce(p_reason,'')))<2 then raise exception 'A rejection reason is required'; end if;
 update public.sacco_withdrawal_requests set status=case when p_decision='approve' then 'approved' else 'rejected' end,approved_amount=case when p_decision='approve' then coalesce(p_approved_amount,v.amount) else null end,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=case when p_decision='reject' then left(trim(p_reason),1000) else null end,updated_at=now() where id=p_request_id returning * into v;
 return v;
end $$;
revoke all on function public.sacco_review_withdrawal(uuid,text,text,numeric) from public,anon;
grant execute on function public.sacco_review_withdrawal(uuid,text,text,numeric) to authenticated;

create or replace function public.sacco_record_withdrawal_payment(p_request_id uuid,p_payment_reference text default null,p_payment_note text default null,p_paid_on date default null)
returns public.sacco_withdrawal_requests language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.sacco_withdrawal_requests; v_balance numeric;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select w.* into v from public.sacco_withdrawal_requests w where w.id=p_request_id for update;
 if not found then raise exception 'Withdrawal request not found'; end if;
 if not (public.has_company_role(v.company_id,array['owner','admin','manager','accountant']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=v.company_id and r.user_id=auth.uid() and r.role in ('analyst','secretary','mobilizer','chairperson'))) then raise exception 'You are not authorized to record a withdrawal payment'; end if;
 if v.status<>'approved' then raise exception 'Only an approved withdrawal can be paid'; end if;
 select coalesce(sum(case when entry_type='deposit' then amount when entry_type='withdrawal' then -amount else 0 end),0) into v_balance from public.sacco_savings_entries where company_id=v.company_id and member_id=v.member_id and status='confirmed';
 if v.approved_amount>v_balance then raise exception 'Confirmed balance changed; review the request again'; end if;
 insert into public.sacco_savings_entries(company_id,member_id,term_id,entry_type,amount,transaction_date,payment_method,channel,reference,notes,status,submitted_by,reviewed_by,reviewed_at,withdrawal_request_id)
 values(v.company_id,v.member_id,v.term_id,'withdrawal',v.approved_amount,coalesce(p_paid_on,(now() at time zone 'Africa/Kampala')::date),v.payment_method,v.channel,left(coalesce(p_payment_reference,''),200),left(coalesce(p_payment_note,'Withdrawal payment recorded'),1000),'confirmed',auth.uid(),auth.uid(),now(),v.id);
 update public.sacco_withdrawal_requests set status='paid',paid_amount=approved_amount,paid_by=auth.uid(),paid_at=now(),payment_reference=nullif(left(trim(coalesce(p_payment_reference,'')),200),''),payment_note=left(coalesce(p_payment_note,''),1000),updated_at=now() where id=p_request_id returning * into v;
 return v;
end $$;
revoke all on function public.sacco_record_withdrawal_payment(uuid,text,text,date) from public,anon;
grant execute on function public.sacco_record_withdrawal_payment(uuid,text,text,date) to authenticated;
