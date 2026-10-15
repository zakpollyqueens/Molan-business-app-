-- Role-checked atomic review and withdrawal posting functions.
create or replace function public.sacco_review_savings(p_entry_id uuid,p_decision text,p_reason text default null)
returns public.sacco_savings_entries language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.sacco_savings_entries;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_decision not in ('confirm','reject') then raise exception 'Decision must be confirm or reject'; end if;
 select e.* into v from public.sacco_savings_entries e where e.id=p_entry_id for update;
 if not found then raise exception 'Savings entry not found'; end if;
 if not (public.has_company_role(v.company_id,array['owner','admin']::text[]) or exists(select 1 from public.sacco_role_assignments r where r.company_id=v.company_id and r.user_id=auth.uid() and r.role='chairperson')) then raise exception 'Only the chairperson or authorized company admin can review savings'; end if;
 if v.status<>'pending' then raise exception 'This savings entry has already been reviewed'; end if;
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
