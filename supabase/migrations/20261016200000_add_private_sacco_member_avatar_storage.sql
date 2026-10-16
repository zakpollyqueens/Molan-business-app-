-- Store savings-circle member photos privately, scoped to the owning company.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sacco-member-avatars', 'sacco-member-avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Company members view SACCO member avatars" on storage.objects;
create policy "Company members view SACCO member avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'sacco-member-avatars'
  and split_part(name, '/', 2) = 'members'
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    then public.is_company_member(split_part(name, '/', 1)::uuid)
    else false
  end
);

drop policy if exists "Company members upload SACCO member avatars" on storage.objects;
create policy "Company members upload SACCO member avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sacco-member-avatars'
  and split_part(name, '/', 2) = 'members'
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    then public.is_company_member(split_part(name, '/', 1)::uuid)
    else false
  end
);

drop policy if exists "Company admins delete SACCO member avatars" on storage.objects;
create policy "Company admins delete SACCO member avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'sacco-member-avatars'
  and split_part(name, '/', 2) = 'members'
  and case
    when split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
    then private.has_company_role(split_part(name, '/', 1)::uuid, array['owner','admin'])
    else false
  end
);
