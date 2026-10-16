drop policy if exists notifications_member_create on public.company_workspace_notifications;
create policy notifications_member_create on public.company_workspace_notifications for insert to authenticated with check (
 created_by=(select auth.uid()) and exists(select 1 from public.company_members m where m.company_id=company_workspace_notifications.company_id and m.user_id=(select auth.uid()) and m.status='active')
);