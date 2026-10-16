drop trigger if exists set_website_service_package_price on public.website_service_requests;
create trigger set_website_service_package_price
  before insert or update of package_code, market_code
  on public.website_service_requests
  for each row execute function private.set_website_service_package_price();