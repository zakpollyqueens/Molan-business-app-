alter table public.website_service_requests
  drop constraint if exists website_service_requests_payment_status_check;
alter table public.website_service_requests
  add constraint website_service_requests_payment_status_check
  check (payment_status in ('unpaid','pending','partially_paid','paid','failed'));

create or replace function private.set_website_service_package_price()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare selected_market text;
begin
  selected_market := upper(coalesce(nullif(new.market_code, ''), 'UG'));
  if selected_market not in ('UG','KE','TZ','OTHER') then
    raise exception 'Unsupported website service pricing market.';
  end if;
  if new.package_code not in ('starter','premium','business') then
    raise exception 'Unsupported website service package.';
  end if;

  if coalesce(new.payment_plan, 'full') in ('full','full_amount') then
    new.payment_plan := 'full';
  elsif coalesce(new.payment_plan, 'two_part') in ('two_part','installments') then
    new.payment_plan := 'two_part';
  else
    raise exception 'Unsupported website service payment plan.';
  end if;

  new.market_code := selected_market;
  new.package_price_ugx := case new.package_code
    when 'starter' then 270000 when 'premium' then 350000 when 'business' then 490000 end;
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
  new.deposit_amount := round(new.package_amount / 2.0, 2);
  new.balance_amount := new.package_amount - new.deposit_amount;
  return new;
end;
$function$;

drop trigger if exists set_website_service_package_price on public.website_service_requests;
create trigger set_website_service_package_price
  before insert or update of package_code, market_code, payment_plan
  on public.website_service_requests
  for each row execute function private.set_website_service_package_price();