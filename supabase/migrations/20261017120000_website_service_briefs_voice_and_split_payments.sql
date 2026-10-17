-- Website service briefs, private voice notes, and split-payment schedule.
alter table public.website_service_requests
  add column if not exists public_business_name text,
  add column if not exists public_information text,
  add column if not exists public_contacts text,
  add column if not exists business_location text,
  add column if not exists preferred_domain text,
  add column if not exists voice_note_path text,
  add column if not exists payment_plan text not null default 'full_amount',
  add column if not exists deposit_amount numeric not null default 0,
  add column if not exists balance_amount numeric not null default 0,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists terms_accepted_at timestamptz;

alter table public.website_service_requests
  drop constraint if exists website_service_requests_payment_plan_check;
alter table public.website_service_requests
  add constraint website_service_requests_payment_plan_check
  check (payment_plan in ('full_amount','installments'));

create or replace function private.set_website_service_package_price()
returns trigger
language plpgsql
set search_path = ''
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
  if coalesce(new.payment_plan, 'full_amount') not in ('full_amount','installments') then
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
  new.payment_plan := coalesce(new.payment_plan, 'full_amount');
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

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('website-service-voice-notes','website-service-voice-notes',false,15728640,array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'])
on conflict (id) do update set public=false, file_size_limit=15728640, allowed_mime_types=array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav'];

drop policy if exists "website voice notes deletable by uploader or company admin" on storage.objects;
drop policy if exists "website voice notes upload by active company members" on storage.objects;
drop policy if exists "website voice notes visible to company members" on storage.objects;

drop policy if exists "website voice note upload by workspace admins" on storage.objects;
create policy "website voice note upload by workspace admins"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'website-service-voice-notes'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid() and cm.status = 'active'
      and lower(cm.role) in ('owner','admin')
  )
);
drop policy if exists "website voice note read by workspace admins" on storage.objects;
create policy "website voice note read by workspace admins"
on storage.objects for select to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid() and cm.status = 'active'
      and lower(cm.role) in ('owner','admin')
  )
);
drop policy if exists "website voice note delete by workspace admins" on storage.objects;
create policy "website voice note delete by workspace admins"
on storage.objects for delete to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid() and cm.status = 'active'
      and lower(cm.role) in ('owner','admin')
  )
);
