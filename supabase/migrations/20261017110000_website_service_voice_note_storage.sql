-- Keep website-service voice briefs private and scoped to the requesting company's members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-service-voice-notes',
  'website-service-voice-notes',
  false,
  20971520,
  array['audio/webm','audio/mp4','audio/m4a','audio/ogg','audio/mpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['audio/webm','audio/mp4','audio/m4a','audio/ogg','audio/mpeg'];

drop policy if exists "Company members view website service voice notes" on storage.objects;
create policy "Company members view website service voice notes"
on storage.objects for select to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and case when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    then public.is_company_member(split_part(name, '/', 1)::uuid)
    else false end
);

drop policy if exists "Company members upload website service voice notes" on storage.objects;
create policy "Company members upload website service voice notes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'website-service-voice-notes'
  and case when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    then public.is_company_member(split_part(name, '/', 1)::uuid)
    else false end
);

drop policy if exists "Company admins delete website service voice notes" on storage.objects;
create policy "Company admins delete website service voice notes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and case when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    then private.has_company_role(split_part(name, '/', 1)::uuid, array['owner','admin'])
    else false end
);
