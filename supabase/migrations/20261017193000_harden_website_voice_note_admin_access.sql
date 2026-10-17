-- Restrict private website-service voice notes to active workspace owners/admins.
-- This forward migration supersedes earlier member-wide and request-owner storage policies.
begin;

drop policy if exists "Company members view website service voice notes" on storage.objects;
drop policy if exists "Company members upload website service voice notes" on storage.objects;
drop policy if exists "Company admins delete website service voice notes" on storage.objects;
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
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.has_company_role(split_part(name, '/', 1)::uuid, array['owner','admin']::text[])
    else false
  end
);

create policy "website voice note read by workspace admins"
on storage.objects for select to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.has_company_role(split_part(name, '/', 1)::uuid, array['owner','admin']::text[])
    else false
  end
);

drop policy if exists "website voice note delete by workspace admins" on storage.objects;
create policy "website voice note delete by workspace admins"
on storage.objects for delete to authenticated
using (
  bucket_id = 'website-service-voice-notes'
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.has_company_role(split_part(name, '/', 1)::uuid, array['owner','admin']::text[])
    else false
  end
);

commit;
