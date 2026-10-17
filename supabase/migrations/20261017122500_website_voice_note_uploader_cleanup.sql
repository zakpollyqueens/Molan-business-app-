drop policy if exists "website voice note delete by uploader or company admin" on storage.objects;
create policy "website voice note delete by uploader or company admin"
on storage.objects for delete to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and case
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (
      (storage.foldername(name))[2] = auth.uid()::text
      or private.has_company_role(((storage.foldername(name))[1])::uuid,array['owner','admin']::text[])
    )
    else false
  end
);