-- Harden collaboration authorization: reactions are self-managed, notifications are role-controlled,
-- and confidential Board of Governors records remain owner/linked-board-member only.
drop policy if exists chat_reactions_member_all on public.company_chat_reactions;
drop policy if exists chat_reactions_member_read on public.company_chat_reactions;
drop policy if exists chat_reactions_self_insert on public.company_chat_reactions;
drop policy if exists chat_reactions_self_delete on public.company_chat_reactions;
create policy chat_reactions_member_read on public.company_chat_reactions for select to authenticated
using (exists(select 1 from public.company_members m where m.company_id=company_chat_reactions.company_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy chat_reactions_self_insert on public.company_chat_reactions for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.company_members m where m.company_id=company_chat_reactions.company_id and m.user_id=(select auth.uid()) and m.status='active'));
create policy chat_reactions_self_delete on public.company_chat_reactions for delete to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.company_members m where m.company_id=company_chat_reactions.company_id and m.user_id=(select auth.uid()) and m.status='active'));

drop policy if exists board_members_owner_manage on public.company_board_members;
create policy board_members_owner_manage on public.company_board_members for all to authenticated
using (exists(select 1 from public.company_members m where m.company_id=company_board_members.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role)='owner'))
with check (added_by=(select auth.uid()) and exists(select 1 from public.company_members m where m.company_id=company_board_members.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role)='owner'));

drop policy if exists board_records_confidential_access on public.company_board_records;
create policy board_records_confidential_access on public.company_board_records for select to authenticated
using (
 exists(select 1 from public.company_members m where m.company_id=company_board_records.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role)='owner')
 or exists(select 1 from public.company_board_members b where b.company_id=company_board_records.company_id and b.user_id=(select auth.uid()))
 or (visibility='published' and exists(select 1 from public.company_members m where m.company_id=company_board_records.company_id and m.user_id=(select auth.uid()) and m.status='active'))
);
drop policy if exists board_records_board_create on public.company_board_records;
create policy board_records_board_create on public.company_board_records for insert to authenticated
with check (created_by=(select auth.uid()) and (
 exists(select 1 from public.company_members m where m.company_id=company_board_records.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role)='owner')
 or exists(select 1 from public.company_board_members b where b.company_id=company_board_records.company_id and b.user_id=(select auth.uid()))
));
drop policy if exists board_records_owner_update on public.company_board_records;
create policy board_records_owner_update on public.company_board_records for update to authenticated
using (exists(select 1 from public.company_members m where m.company_id=company_board_records.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role)='owner'))
with check (exists(select 1 from public.company_members m where m.company_id=company_board_records.company_id and m.user_id=(select auth.uid()) and m.status='active' and lower(m.role)='owner'));

drop policy if exists notifications_member_create on public.company_workspace_notifications;
drop policy if exists notifications_authorized_create on public.company_workspace_notifications;
create policy notifications_authorized_create on public.company_workspace_notifications for insert to authenticated
with check (created_by=(select auth.uid()) and exists(
 select 1 from public.company_members m where m.company_id=company_workspace_notifications.company_id
 and m.user_id=(select auth.uid()) and m.status='active'
 and lower(m.role) in ('owner','admin','manager')
));
