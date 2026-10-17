alter table public.website_service_requests
  add column if not exists business_name text,
  add column if not exists public_contacts text,
  add column if not exists business_location text,
  add column if not exists preferred_domain text,
  add column if not exists website_feel text,
  add column if not exists payment_plan text not null default 'full',
  add column if not exists voice_note_path text,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists deposit_provider_reference text;

alter table public.website_service_requests
  drop constraint if exists website_service_requests_payment_plan_check;
alter table public.website_service_requests
  add constraint website_service_requests_payment_plan_check
  check (payment_plan in ('full','two_part'));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('website-service-voice-notes','website-service-voice-notes',false,10485760,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a'])
on conflict (id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "website voice notes upload by active company members" on storage.objects;
create policy "website voice notes upload by active company members"
on storage.objects for insert to authenticated
with check (
  bucket_id='website-service-voice-notes'
  and split_part(name,'/',2)=auth.uid()::text
  and private.is_company_member((split_part(name,'/',1))::uuid)
);
drop policy if exists "website voice notes visible to company members" on storage.objects;
create policy "website voice notes visible to company members"
on storage.objects for select to authenticated
using (
  bucket_id='website-service-voice-notes'
  and private.is_company_member((split_part(name,'/',1))::uuid)
);
drop policy if exists "website voice notes deletable by uploader or company admin" on storage.objects;
create policy "website voice notes deletable by uploader or company admin"
on storage.objects for delete to authenticated
using (
  bucket_id='website-service-voice-notes'
  and (
    split_part(name,'/',2)=auth.uid()::text
    or private.has_company_role((split_part(name,'/',1))::uuid,array['owner','admin']::text[])
  )
);
