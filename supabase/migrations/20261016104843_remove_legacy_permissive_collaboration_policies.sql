-- Remove legacy permissive policies that would otherwise OR-bypass the tightened rules.
drop policy if exists board_records_owner_board_create on public.company_board_records;
drop policy if exists workspace_notifications_member_create on public.company_workspace_notifications;
-- Explicitly document the surviving policy set and keep notifications owner/admin/manager-only.
drop policy if exists notifications_member_create on public.company_workspace_notifications;
drop policy if exists notifications_authorized_create on public.company_workspace_notifications;
create policy notifications_authorized_create on public.company_workspace_notifications for insert to authenticated
with check (created_by=(select auth.uid()) and exists(
 select 1 from public.company_members m where m.company_id=company_workspace_notifications.company_id
 and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role) in ('owner','admin','manager')
));
