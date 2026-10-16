-- Enable checkout for explicitly approved package prices after the JJuma Pay integration is installed.
-- This does not enable unconfigured/pending market prices.
alter table public.subscription_plan_prices
  add column if not exists package_amount numeric(12,2);

update public.subscription_plan_prices
set checkout_enabled = true,
    updated_at = now()
where price_status = 'approved'
  and package_amount is not null
  and package_amount > 0;

comment on column public.subscription_plan_prices.checkout_enabled
is 'When true, the approved package price may be used to create a hosted checkout through the configured payment provider.';

