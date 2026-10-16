-- Paid subscriptions expire at their purchased plan end date; do not silently extend paid access.
-- Trial/profile grace is represented separately and must end at its configured expiry.
create or replace function public.activate_verified_company_subscription(p_company_id uuid,p_payment_event_id uuid)
returns public.company_subscriptions
language plpgsql security invoker set search_path=public,pg_temp
as $$
declare
 v_event public.subscription_payment_events%rowtype;
 v_plan public.subscription_plan_catalog%rowtype;
 v_price public.subscription_plan_prices%rowtype;
 v_current public.company_subscriptions%rowtype;
 v_start timestamptz;
 v_expiry timestamptz;
 v_result public.company_subscriptions%rowtype;
begin
 select * into v_event from public.subscription_payment_events where id=p_payment_event_id and company_id=p_company_id for update;
 if not found or v_event.status<>'verified' or v_event.verified_at is null then raise exception 'A verified payment event is required before activation'; end if;
 select * into v_plan from public.subscription_plan_catalog where plan_code=v_event.plan_code and is_active=true;
 if not found then raise exception 'Subscription plan is not active'; end if;
 select * into v_price from public.subscription_plan_prices where plan_code=v_event.plan_code and currency_code=v_event.currency_code and price_status='approved' and checkout_enabled=true limit 1;
 if not found or v_price.monthly_amount is null then raise exception 'Approved checkout pricing is not configured for this currency'; end if;
 if round(v_event.amount,2)<>round(v_price.monthly_amount*v_plan.duration_months,2) then raise exception 'Verified payment amount does not match the approved plan total'; end if;
 select * into v_current from public.company_subscriptions where company_id=p_company_id for update;
 v_start:=case when found and v_current.status='active' and v_current.expires_at>now() then v_current.expires_at else now() end;
 v_expiry:=v_start+make_interval(months=>v_plan.duration_months);
 insert into public.company_subscriptions(company_id,plan_code,status,started_at,expires_at,grace_ends_at,activation_source,last_payment_event_id,updated_at)
 values(p_company_id,v_plan.plan_code,'active',v_start,v_expiry,null,'verified_payment',p_payment_event_id,now())
 on conflict(company_id) do update set plan_code=excluded.plan_code,status='active',started_at=excluded.started_at,expires_at=excluded.expires_at,
 grace_ends_at=null,activation_source='verified_payment',last_payment_event_id=excluded.last_payment_event_id,updated_at=now()
 returning * into v_result;
 update public.subscription_payment_events set period_started_at=v_start,period_expires_at=v_expiry where id=p_payment_event_id;
 return v_result;
end; $$;
revoke all on function public.activate_verified_company_subscription(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_verified_company_subscription(uuid,uuid) to service_role;
