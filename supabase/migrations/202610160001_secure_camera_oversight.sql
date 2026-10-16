-- Applied to the Molan Business Supabase project as migration secure_camera_oversight_for_workspace_admins.
-- This repository copy records the policies that enforce camera/location privacy.
-- Camera and location access is limited to active workspace owners and admins.
-- Camera inserts must be made by the signed-in creator and point to a location in the same company.

drop policy if exists "Company owners manage connected cameras" on public.business_cameras;
drop policy if exists "Company owners manage connected locations" on public.business_locations;

create policy "Workspace owners and admins read connected cameras"
on public.business_cameras for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_cameras.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
));

create policy "Workspace owners and admins add connected cameras"
on public.business_cameras for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.company_members m
    where m.company_id = business_cameras.company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner','admin')
  )
  and exists (
    select 1 from public.business_locations l
    where l.id = business_cameras.location_id
      and l.company_id = business_cameras.company_id
  )
);

create policy "Workspace owners and admins update connected cameras"
on public.business_cameras for update to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_cameras.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.company_members m
  where m.company_id = business_cameras.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
) and exists (
  select 1 from public.business_locations l
  where l.id = business_cameras.location_id
    and l.company_id = business_cameras.company_id
));

create policy "Workspace owners and admins delete connected cameras"
on public.business_cameras for delete to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_cameras.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
));

create policy "Workspace owners and admins read connected locations"
on public.business_locations for select to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_locations.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
));

create policy "Workspace owners and admins add connected locations"
on public.business_locations for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.company_members m
    where m.company_id = business_locations.company_id
      and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner','admin')
  )
);

create policy "Workspace owners and admins update connected locations"
on public.business_locations for update to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_locations.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.company_members m
  where m.company_id = business_locations.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
));

create policy "Workspace owners and admins delete connected locations"
on public.business_locations for delete to authenticated
using (exists (
  select 1 from public.company_members m
  where m.company_id = business_locations.company_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role in ('owner','admin')
));
