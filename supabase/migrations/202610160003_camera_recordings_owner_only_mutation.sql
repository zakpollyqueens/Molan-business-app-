-- Keep recording segments immutable for staff. Trusted ingestion runs through a server-side provider/recorder integration using the service role.
drop policy if exists "Camera managers add recording metadata" on public.business_camera_recordings;
drop policy if exists "Camera managers update recording metadata" on public.business_camera_recordings;
drop policy if exists "Only business owner updates recording metadata" on public.business_camera_recordings;
create policy "Only business owner updates recording metadata"
on public.business_camera_recordings for update to authenticated
using (
  exists (select 1 from public.company_members m
    where m.company_id=business_camera_recordings.company_id
      and m.user_id=(select auth.uid()) and m.role='owner' and m.status='active')
)
with check (
  exists (select 1 from public.company_members m
    where m.company_id=business_camera_recordings.company_id
      and m.user_id=(select auth.uid()) and m.role='owner' and m.status='active')
);

drop policy if exists "Camera manager uploads recordings" on storage.objects;
drop policy if exists "Camera managers upload recordings" on storage.objects;
drop policy if exists "Camera manager updates recordings" on storage.objects;
drop policy if exists "Only business owner updates private camera recordings" on storage.objects;
create policy "Only business owner updates private camera recordings"
on storage.objects for update to authenticated
using (
  bucket_id='private-camera-recordings'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (select 1 from public.company_members m
    where m.company_id=((storage.foldername(name))[1])::uuid
      and m.user_id=(select auth.uid()) and m.role='owner' and m.status='active')
)
with check (
  bucket_id='private-camera-recordings'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (select 1 from public.company_members m
    where m.company_id=((storage.foldername(name))[1])::uuid
      and m.user_id=(select auth.uid()) and m.role='owner' and m.status='active')
);
-- No authenticated INSERT policy is intentionally created: recording ingestion must use a trusted provider webhook/relay.
