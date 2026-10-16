-- Molan Business subscription catalogue, durations and payment-verification foundation.
-- Regional amounts are deliberately unconfigured until the approved local rate card is supplied.
-- Checkout remains disabled until a provider integration verifies payment events.

create table if not exists public.subscription_plan_catalog (
  plan_code text primary key check (plan_code in ('gold','silver','premium')),
  display_name text not null unique,
  duration_months integer not null check (duration_months between 1 and 36),
  usd_monthly_reference numeric(12,2) not null check (usd_monthly_reference >= 0),
  description text not null default '',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.subscription_plan_catalog(plan_code,display_name,duration_months,usd_monthly_reference,description,display_order)
values
 ('gold','Gold',3,100.00,'Three-month duration; USD monthly amount is a proposed reference.',1),
 ('silver','Silver',2,60.00,'Two-month duration; USD monthly amount is a proposed reference.',2),
 ('premium','Premium',1,50.00,'One-month duration; USD monthly amount is a proposed reference.',3)
on conflict(plan_code) do update set display_name=excluded.display_name,duration_months=excluded.duration_months,
 usd_monthly_reference=excluded.usd_monthly_reference,description=excluded.description,is_active=true,
 display_order=excluded.display_order,updated_at=now();

create table if not exists public.subscription_plan_prices (
 id uuid primary key default gen_random_uuid(),
 plan_code text not null references public.subscription_plan_catalog(plan_code) on delete cascade,
 market_code text not null,
 country_code text,
 currency_code text,
 monthly_amount numeric(12,2),
 price_status text not null default 'pending_configuration'
   check(price_status in ('pending_configuration','proposed','approved')),
 checkout_enabled boolean not null default false,
 is_visible boolean not null default true,
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(plan_code,market_code),
 check(monthly_amount is null or monthly_amount>=0)
);
insert into public.subscription_plan_prices(plan_code,market_code,country_code,currency_code,monthly_amount,price_status,checkout_enabled,is_visible,notes)
select p.plan_code,m.market_code,m.country_code,m.currency_code,
 case when m.market_code='USD' then p.usd_monthly_reference else null end,
 case when m.market_code='USD' then 'proposed' else 'pending_configuration' end,
 false,true,
 case when m.market_code='UG' then 'Keep existing Uganda rates unchanged; confirm the approved price list before setting an amount.'
      when m.market_code='USD' then 'Proposed monthly reference only; package total is monthly amount multiplied by plan duration. Checkout is disabled.'
      else 'Configure approved local currency and regional uplift before checkout.' end
from public.subscription_plan_catalog p
cross join (values
 ('UG','UG','UGX'),('KE','KE','KES'),('TZ','TZ','TZS'),('RW','RW','RWF'),('BI','BI','BIF'),('SS','SS','SSP'),
 ('OTHER_AFRICA',null,null),('USD',null,'USD'),('OTHER',null,null)
) as m(market_code,country_code,currency_code)
on conflict(plan_code,market_code) do update set country_code=excluded.country_code,currency_code=excluded.currency_code,
 monthly_amount=case when subscription_plan_prices.price_status='approved' then subscription_plan_prices.monthly_amount else excluded.monthly_amount end,
 price_status=case when subscription_plan_prices.price_status='approved' then subscription_plan_prices.price_status else excluded.price_status end,
 checkout_enabled=case when subscription_plan_prices.price_status='approved' then subscription_plan_prices.checkout_enabled else false end,
 is_visible=true,notes=excluded.notes,updated_at=now();

create table if not exists public.company_subscriptions (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null unique references public.company_profiles(id) on delete cascade,
 plan_code text references public.subscription_plan_catalog(plan_code),
 status text not null default 'trial' check(status in ('trial','active','expired','locked','cancelled','past_due')),
 started_at timestamptz,
 expires_at timestamptz,
 grace_ends_at timestamptz,
 auto_renew boolean not null default false,
 activation_source text not null default 'trial' check(activation_source in ('trial','verified_payment','manual_admin','migration')),
 last_payment_event_id uuid,
 admin_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(expires_at is null or started_at is null or expires_at>started_at)
);
create table if not exists public.subscription_payment_events (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.company_profiles(id) on delete cascade,
 plan_code text not null references public.subscription_plan_catalog(plan_code),
 provider text not null,
 provider_reference text,
 amount numeric(12,2) not null check(amount>0),
 currency_code text not null,
 status text not null default 'pending' check(status in ('pending','verified','failed','refunded','reversed')),
 paid_at timestamptz,
 period_started_at timestamptz,
 period_expires_at timestamptz,
 provider_metadata jsonb not null default '{}'::jsonb,
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 unique(provider,provider_reference)
);
alter table public.company_subscriptions drop constraint if exists company_subscriptions_last_payment_event_id_fkey;
alter table public.company_subscriptions add constraint company_subscriptions_last_payment_event_id_fkey
 foreign key(last_payment_event_id) references public.subscription_payment_events(id) on delete set null;
create index if not exists company_subscriptions_status_expiry_idx on public.company_subscriptions(status,expires_at);
create index if not exists subscription_payment_events_company_created_idx on public.subscription_payment_events(company_id,created_at desc);
create index if not exists subscription_payment_events_status_idx on public.subscription_payment_events(status,created_at);

alter table public.subscription_plan_catalog enable row level security;
alter table public.subscription_plan_prices enable row level security;
alter table public.company_subscriptions enable row level security;
alter table public.subscription_payment_events enable row level security;
drop policy if exists "Published subscription plans are readable" on public.subscription_plan_catalog;
create policy "Published subscription plans are readable" on public.subscription_plan_catalog for select to anon,authenticated using(is_active);
drop policy if exists "Visible subscription prices are readable" on public.subscription_plan_prices;
create policy "Visible subscription prices are readable" on public.subscription_plan_prices for select to anon,authenticated using(is_visible);
drop policy if exists "Company owners and admins can view subscription status" on public.company_subscriptions;
create policy "Company owners and admins can view subscription status" on public.company_subscriptions for select to authenticated
 using(exists(select 1 from public.company_members m where m.company_id=company_subscriptions.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role) in ('owner','admin')));
drop policy if exists "Company owners and admins can view subscription payment history" on public.subscription_payment_events;
create policy "Company owners and admins can view subscription payment history" on public.subscription_payment_events for select to authenticated
 using(exists(select 1 from public.company_members m where m.company_id=subscription_payment_events.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role) in ('owner','admin')));
revoke all on public.subscription_plan_catalog from anon,authenticated;
revoke all on public.subscription_plan_prices from anon,authenticated;
grant select on public.subscription_plan_catalog to anon,authenticated;
grant select on public.subscription_plan_prices to anon,authenticated;
revoke all on public.company_subscriptions from anon,authenticated;
grant select on public.company_subscriptions to authenticated;
revoke all on public.subscription_payment_events from anon,authenticated;
grant select on public.subscription_payment_events to authenticated;

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
 values(p_company_id,v_plan.plan_code,'active',v_start,v_expiry,v_expiry+interval '30 days','verified_payment',p_payment_event_id,now())
 on conflict(company_id) do update set plan_code=excluded.plan_code,status='active',started_at=excluded.started_at,expires_at=excluded.expires_at,
 grace_ends_at=excluded.grace_ends_at,activation_source='verified_payment',last_payment_event_id=excluded.last_payment_event_id,updated_at=now()
 returning * into v_result;
 update public.subscription_payment_events set period_started_at=v_start,period_expires_at=v_expiry where id=p_payment_event_id;
 return v_result;
end; $$;
revoke all on function public.activate_verified_company_subscription(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_verified_company_subscription(uuid,uuid) to service_role;
