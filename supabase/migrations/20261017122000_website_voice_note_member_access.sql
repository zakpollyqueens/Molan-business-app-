-- Private website voice notes are restricted to active workspace owners/admins.
-- The earlier member-access policy was too broad and its path shape did not match request-scoped uploads.
drop policy if exists "website voice notes upload by active company members" on storage.objects;
drop policy if exists "website voice notes visible to company members" on storage.objects;
drop policy if exists "website voice notes deletable by uploader or company admin" on storage.objects;
drop policy if exists "website voice note upload by request owner" on storage.objects;
drop policy if exists "website voice note read by active company members" on storage.objects;
drop policy if exists "Company members upload website service voice notes" on storage.objects;
drop policy if exists "Company members view website service voice notes" on storage.objects;
drop policy if exists "website voice note upload by workspace admins" on storage.objects;
drop policy if exists "website voice note read by workspace admins" on storage.objects;

create policy "website voice note upload by workspace admins"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'website-service-voice-notes'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and lower(cm.role) in ('owner','admin')
  )
);

create policy "website voice note read by workspace admins"
on storage.objects for select to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and exists (
    select 1 from public.company_members cm
    where cm.company_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and lower(cm.role) in ('owner','admin')
  )
);
