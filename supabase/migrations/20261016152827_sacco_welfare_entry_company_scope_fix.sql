-- Scope welfare-account other income, expenses and contributions to an explicitly selected company.
create or replace function public.sacco_welfare_record_other_entry(
 p_company_id uuid,p_entry_type text,p_amount numeric,p_transaction_date date,p_payment_method text,p_reference text default null,p_notes text default null
) returns public.sacco_welfare_entries
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v public.sacco_welfare_entries;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not public.is_company_member(p_company_id) or not public.sacco_welfare_is_recorder(p_company_id) then raise exception 'Authorized welfare-account staff required for this company'; end if;
 if p_entry_type not in ('contribution','other_income','expense') or p_amount<=0 or p_transaction_date is null then raise exception 'Enter valid contribution, income or expense details'; end if;
 if p_payment_method not in ('cash','mobile_money','bank','card','other') then raise exception 'Unsupported payment method'; end if;
 insert into public.sacco_welfare_entries(company_id,entry_type,amount,transaction_date,payment_method,reference,notes,status,created_by,reviewed_by,reviewed_at)
 values(p_company_id,p_entry_type,p_amount,p_transaction_date,p_payment_method,nullif(trim(p_reference),''),nullif(trim(p_notes),''),'confirmed',auth.uid(),auth.uid(),now()) returning * into v;
 return v;
end $$;
revoke all on function public.sacco_welfare_record_other_entry(uuid,text,numeric,date,text,text,text) from public,anon;
grant execute on function public.sacco_welfare_record_other_entry(uuid,text,numeric,date,text,text,text) to authenticated;
