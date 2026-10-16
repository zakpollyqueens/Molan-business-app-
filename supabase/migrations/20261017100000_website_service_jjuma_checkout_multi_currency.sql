-- Add server-priced, multi-currency website packages and a verified Jjuma Pay checkout ledger.
-- Existing website requests retain their original price and are labelled as legacy UGX records.
alter table public.website_service_requests
  add column if not exists market_code text not null default 'UG',
  add column if not exists package_currency_code text not null default 'UGX',
  add column if not exists package_amount numeric(12,2),
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_provider_reference text;

update public.website_service_requests
set market_code = coalesce(market_code, 'UG'),
    package_currency_code = coalesce(package_currency_code, 'UGX'),
    package_amount = coalesce(package_amount, package_price_ugx::numeric),
    payment_status = coalesce(payment_status, 'unpaid')
where package_amount is null;

alter table public.website_service_requests
  alter column package_amount set not null,
  alter column package_amount set default 0;

alter table public.website_service_requests
  drop constraint if exists website_service_requests_package_price_ugx_check,
  drop constraint if exists website_service_requests_package_amount_check,
  drop constraint if exists website_service_requests_market_code_check,
  drop constraint if exists website_service_requests_package_currency_code_check,
  drop constraint if exists website_service_requests_payment_status_check;

alter table public.website_service_requests
  add constraint website_service_requests_package_price_ugx_check
    check (package_price_ugx = any(array[200000,270000,300000,350000,450000,490000])),
  add constraint website_service_requests_package_amount_check
    check (package_amount > 0),
  add constraint website_service_requests_market_code_check
    check (market_code = any(array['UG','KE','TZ','OTHER'])),
  add constraint website_service_requests_package_currency_code_check
    check (package_currency_code = any(array['UGX','KES','TZS','USD'])),
  add constraint website_service_requests_payment_status_check
    check (payment_status = any(array['unpaid','pending','paid','failed']));

create or replace function private.set_website_service_package_price()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  selected_market text;
begin
  selected_market := upper(coalesce(nullif(new.market_code, ''), 'UG'));
  if selected_market not in ('UG','KE','TZ','OTHER') then
    raise exception 'Unsupported website service pricing market.';
  end if;
  if new.package_code not in ('starter','premium','business') then
    raise exception 'Unsupported website service package.';
  end if;

  new.market_code := selected_market;
  new.package_price_ugx := case new.package_code
    when 'starter' then 270000
    when 'premium' then 350000
    when 'business' then 490000
  end;

  if selected_market = 'UG' then
    new.package_currency_code := 'UGX';
    new.package_amount := case new.package_code when 'starter' then 270000 when 'premium' then 350000 when 'business' then 490000 end;
  elsif selected_market = 'KE' then
    new.package_currency_code := 'KES';
    new.package_amount := case new.package_code when 'starter' then 300000 when 'premium' then 390000 when 'business' then 530000 end;
  elsif selected_market = 'TZ' then
    new.package_currency_code := 'TZS';
    new.package_amount := case new.package_code when 'starter' then 320000 when 'premium' then 450000 when 'business' then 550000 end;
  else
    new.package_currency_code := 'USD';
    new.package_amount := case new.package_code when 'starter' then 65 when 'premium' then 125 when 'business' then 150 end;
  end if;
  return new;
end;
$function$;

comment on column public.website_service_requests.package_price_ugx
is 'Legacy UGX base-price field retained for compatibility. Current checkout must use package_amount and package_currency_code.';
comment on column public.website_service_requests.package_amount
is 'Authoritative package price set by the database trigger for the selected market.';
comment on column public.website_service_requests.payment_status
is 'Server-maintained payment state: unpaid, pending, paid, or failed.';

create table if not exists public.website_service_checkout_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  request_id uuid not null references public.website_service_requests(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  provider text not null default 'jjuma' check (provider = 'jjuma'),
  provider_reference text,
  amount numeric(12,2) not null check (amount > 0),
  currency_code text not null check (currency_code = any(array['UGX','KES','TZS','USD'])),
  status text not null default 'pending' check (status = any(array['pending','verified','failed'])),
  paid_at timestamptz,
  verified_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists website_service_checkout_provider_reference_uidx
  on public.website_service_checkout_payments(provider, provider_reference)
  where provider_reference is not null;
create unique index if not exists website_service_checkout_one_pending_per_request_uidx
  on public.website_service_checkout_payments(request_id)
  where status = 'pending';
create index if not exists website_service_checkout_company_created_idx
  on public.website_service_checkout_payments(company_id, created_at desc);

alter table public.website_service_checkout_payments enable row level security;
revoke all on public.website_service_checkout_payments from anon, authenticated;
grant select on public.website_service_checkout_payments to authenticated;
grant all on public.website_service_checkout_payments to service_role;
drop policy if exists "members view website service checkout payments" on public.website_service_checkout_payments;
create policy "members view website service checkout payments"
  on public.website_service_checkout_payments
  for select to authenticated
  using (private.is_company_member(company_id));
