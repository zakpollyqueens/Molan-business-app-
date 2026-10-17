drop policy if exists "website voice notes upload by active company members" on storage.objects;
drop policy if exists "website voice notes visible to company members" on storage.objects;
drop policy if exists "website voice notes deletable by uploader or company admin" on storage.objects;
drop policy if exists "website voice note upload by request owner" on storage.objects;
drop policy if exists "website voice note read by active company members" on storage.objects;

create policy "website voice note upload by request owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'website-service-voice-notes'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (storage.foldername(name))[2] = auth.uid()::text
    then private.is_company_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy "website voice note read by active company members"
on storage.objects for select to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.is_company_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);