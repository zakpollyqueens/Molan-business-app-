-- Apply the owner-supplied regional subscription package fees.
-- package_amount is the full fee for the entire plan duration (not a monthly instalment).
alter table public.subscription_plan_prices add column if not exists package_amount numeric(12,2);
insert into public.subscription_plan_prices
 (plan_code,market_code,country_code,currency_code,monthly_amount,package_amount,price_status,checkout_enabled,is_visible,notes)
values
 ('gold','UG','UG','UGX',33333.33,100000,'approved',false,true,'Full 3-month package fee; renewal every 3 months. Checkout disabled until provider integration.'),
 ('silver','UG','UG','UGX',35000,70000,'approved',false,true,'Full 2-month package fee; renewal every 2 months. Checkout disabled until provider integration.'),
 ('premium','UG','UG','UGX',30000,30000,'approved',false,true,'Full 1-month package fee; renewal monthly. Checkout disabled until provider integration.'),
 ('gold','KE','KE','KES',30000,90000,'approved',false,true,'Full 3-month package fee; renewal every 3 months. Checkout disabled until provider integration.'),
 ('silver','KE','KE','KES',40000,80000,'approved',false,true,'Full 2-month package fee; renewal every 2 months. Checkout disabled until provider integration.'),
 ('premium','KE','KE','KES',70000,70000,'approved',false,true,'Full 1-month package fee; renewal monthly. Checkout disabled until provider integration.'),
 ('gold','TZ','TZ','TZS',46666.67,140000,'approved',false,true,'Full 3-month package fee; renewal every 3 months. Checkout disabled until provider integration.'),
 ('silver','TZ','TZ','TZS',60000,120000,'approved',false,true,'Full 2-month package fee; renewal every 2 months. Checkout disabled until provider integration.'),
 ('premium','TZ','TZ','TZS',90000,90000,'approved',false,true,'Full 1-month package fee; renewal monthly. Checkout disabled until provider integration.'),
 ('gold','OTHER_AFRICA',null,'USD',26.67,80,'approved',false,true,'USD package fee for other African countries; renew every 3 months.'),
 ('silver','OTHER_AFRICA',null,'USD',25,50,'approved',false,true,'USD package fee for other African countries; renew every 2 months.'),
 ('premium','OTHER_AFRICA',null,'USD',40,40,'approved',false,true,'USD package fee for other African countries; renew monthly.'),
 ('gold','RW','RW','USD',26.67,80,'approved',false,true,'USD package fee for other African countries; renew every 3 months.'),
 ('silver','RW','RW','USD',25,50,'approved',false,true,'USD package fee for other African countries; renew every 2 months.'),
 ('premium','RW','RW','USD',40,40,'approved',false,true,'USD package fee for other African countries; renew monthly.'),
 ('gold','BI','BI','USD',26.67,80,'approved',false,true,'USD package fee for other African countries; renew every 3 months.'),
 ('silver','BI','BI','USD',25,50,'approved',false,true,'USD package fee for other African countries; renew every 2 months.'),
 ('premium','BI','BI','USD',40,40,'approved',false,true,'USD package fee for other African countries; renew monthly.'),
 ('gold','SS','SS','USD',26.67,80,'approved',false,true,'USD package fee for other African countries; renew every 3 months.'),
 ('silver','SS','SS','USD',25,50,'approved',false,true,'USD package fee for other African countries; renew every 2 months.'),
 ('premium','SS','SS','USD',40,40,'approved',false,true,'USD package fee for other African countries; renew monthly.'),
 ('gold','EUROPE',null,'EUR',33.33,100,'approved',false,true,'EUR package fee for Europe; renew every 3 months.'),
 ('silver','EUROPE',null,'EUR',25,50,'approved',false,true,'EUR package fee for Europe; renew every 2 months.'),
 ('premium','EUROPE',null,'EUR',30,30,'approved',false,true,'EUR package fee for Europe; renew monthly.'),
 ('gold','ASIA',null,'USD',26.67,80,'approved',false,true,'USD package fee for Asia; renew every 3 months.'),
 ('silver','ASIA',null,'USD',35,70,'approved',false,true,'USD package fee for Asia; renew every 2 months.'),
 ('premium','ASIA',null,'USD',50,50,'approved',false,true,'USD package fee for Asia; renew monthly.'),
 ('gold','AMERICA',null,'USD',33.33,100,'approved',false,true,'USD package fee for America; renew every 3 months.'),
 ('silver','AMERICA',null,'USD',30,60,'approved',false,true,'USD package fee for America; renew every 2 months.'),
 ('premium','AMERICA',null,'USD',50,50,'approved',false,true,'USD package fee for America; renew monthly.'),
 ('gold','USD',null,'USD',26.67,80,'approved',false,true,'Default USD package fee where no specific market price exists; renew every 3 months.'),
 ('silver','USD',null,'USD',25,50,'approved',false,true,'Default USD package fee where no specific market price exists; renew every 2 months.'),
 ('premium','USD',null,'USD',40,40,'approved',false,true,'Default USD package fee where no specific market price exists; renew monthly.'),
 ('gold','OTHER',null,'USD',26.67,80,'approved',false,true,'Default USD package fee where no specific market price exists; renew every 3 months.'),
 ('silver','OTHER',null,'USD',25,50,'approved',false,true,'Default USD package fee where no specific market price exists; renew every 2 months.'),
 ('premium','OTHER',null,'USD',40,40,'approved',false,true,'Default USD package fee where no specific market price exists; renew monthly.')
on conflict(plan_code,market_code) do update set country_code=excluded.country_code,currency_code=excluded.currency_code,
 monthly_amount=excluded.monthly_amount,package_amount=excluded.package_amount,price_status='approved',
 checkout_enabled=false,is_visible=true,notes=excluded.notes,updated_at=now();

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
 if not found or v_price.package_amount is null then raise exception 'Approved checkout pricing is not configured for this currency'; end if;
 if round(v_event.amount,2)<>round(v_price.package_amount,2) then raise exception 'Verified payment amount does not match the approved package total'; end if;
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