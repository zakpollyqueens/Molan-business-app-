-- Reallocate repayments by actual payment date, including offline repayments entered retrospectively.
create or replace function public.sacco_welfare_record_loan_repayment(
 p_loan_id uuid,p_amount_paid numeric,p_actual_repayment_date date,p_payment_method text,p_reference text default null,p_notes text default null
) returns public.sacco_welfare_loan_repayments
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare
 v public.sacco_welfare_loans; new_rp public.sacco_welfare_loan_repayments; rp public.sacco_welfare_loan_repayments;
 accrued numeric; interest_left numeric; principal_left numeric; running_interest numeric:=0; running_principal numeric:=0;
 i_paid numeric; p_paid numeric; latest_date date; current_accrued numeric; final_interest_paid numeric:=0; final_principal_paid numeric:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into v from public.sacco_welfare_loans where id=p_loan_id for update;
 if not found then raise exception 'Loan not found'; end if;
 if not public.sacco_welfare_is_recorder(v.company_id) then raise exception 'Secretary, analyst, mobilizer or authorized finance staff required'; end if;
 if v.status<>'issued' then raise exception 'Only an issued loan can receive repayment'; end if;
 if p_amount_paid<=0 or p_actual_repayment_date is null or p_actual_repayment_date<v.disbursed_on then raise exception 'Enter a positive repayment and a valid actual repayment date'; end if;
 if p_payment_method not in ('cash','mobile_money','bank','card','other') then raise exception 'Unsupported payment method'; end if;
 insert into public.sacco_welfare_loan_repayments(company_id,loan_id,amount_paid,actual_repayment_date,payment_method,reference,notes,interest_due_at_payment,interest_paid,principal_paid,recorded_by)
 values(v.company_id,v.id,p_amount_paid,p_actual_repayment_date,p_payment_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),0,0,0,auth.uid()) returning * into new_rp;
 for rp in select * from public.sacco_welfare_loan_repayments where company_id=v.company_id and loan_id=v.id order by actual_repayment_date,recorded_at,id loop
  accrued:=round(v.principal*0.05*floor(greatest(0,rp.actual_repayment_date-v.disbursed_on)::numeric/3),2);
  interest_left:=greatest(0,accrued-running_interest); principal_left:=greatest(0,v.principal-running_principal);
  if rp.amount_paid>interest_left+principal_left then raise exception 'Repayment on % exceeds the amount due on that date (UGX %). Review later dated repayments before saving.',rp.actual_repayment_date,interest_left+principal_left; end if;
  i_paid:=least(rp.amount_paid,interest_left); p_paid:=least(greatest(0,rp.amount_paid-i_paid),principal_left);
  update public.sacco_welfare_loan_repayments set interest_due_at_payment=accrued,interest_paid=i_paid,principal_paid=p_paid where id=rp.id;
  running_interest:=running_interest+i_paid; running_principal:=running_principal+p_paid;
  delete from public.sacco_welfare_entries where company_id=v.company_id and reference='LOAN-REPAYMENT:'||rp.id::text;
  if p_paid>0 then
   insert into public.sacco_welfare_entries(company_id,member_id,entry_type,amount,transaction_date,payment_method,reference,notes,status,created_by,reviewed_by,reviewed_at)
   values(v.company_id,v.member_id,'loan_principal_repayment',p_paid,rp.actual_repayment_date,rp.payment_method,'LOAN-REPAYMENT:'||rp.id::text,'Principal repaid for welfare loan '||v.id,'confirmed',rp.recorded_by,rp.recorded_by,rp.recorded_at);
  end if;
  if i_paid>0 then
   insert into public.sacco_welfare_entries(company_id,member_id,entry_type,amount,transaction_date,payment_method,reference,notes,status,created_by,reviewed_by,reviewed_at)
   values(v.company_id,v.member_id,'loan_interest_income',i_paid,rp.actual_repayment_date,rp.payment_method,'LOAN-REPAYMENT:'||rp.id::text,'Automatically credited loan interest for welfare loan '||v.id,'confirmed',rp.recorded_by,rp.recorded_by,rp.recorded_at);
  end if;
 end loop;
 select coalesce(sum(interest_paid),0),coalesce(sum(principal_paid),0) into final_interest_paid,final_principal_paid from public.sacco_welfare_loan_repayments where company_id=v.company_id and loan_id=v.id;
 select max(actual_repayment_date) into latest_date from public.sacco_welfare_loan_repayments where company_id=v.company_id and loan_id=v.id;
 current_accrued:=round(v.principal*0.05*floor(greatest(0,latest_date-v.disbursed_on)::numeric/3),2);
 if final_principal_paid>=v.principal and final_interest_paid>=current_accrued then update public.sacco_welfare_loans set status='repaid' where id=v.id;
 else update public.sacco_welfare_loans set status='issued' where id=v.id; end if;
 select * into new_rp from public.sacco_welfare_loan_repayments where id=new_rp.id;
 return new_rp;
end $$;
revoke all on function public.sacco_welfare_record_loan_repayment(uuid,numeric,date,text,text,text) from public,anon;
grant execute on function public.sacco_welfare_record_loan_repayment(uuid,numeric,date,text,text,text) to authenticated;
