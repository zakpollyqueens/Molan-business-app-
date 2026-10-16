drop policy if exists board_member_self_read on public.company_board_members;
create policy board_member_self_read on public.company_board_members for select to authenticated using (
 user_id=(select auth.uid()) and exists(select 1 from public.company_members m where m.company_id=company_board_members.company_id and m.user_id=(select auth.uid()) and m.status='active')
);