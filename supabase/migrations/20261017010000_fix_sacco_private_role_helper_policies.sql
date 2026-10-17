-- Keep SACCO RLS policies on the non-exposed helper schema.
-- public.has_company_role is intentionally not executable by authenticated users.
-- Policies that referenced it unqualified could fail during reads or writes.
begin;

alter policy sacco_roles_manage_admin on public.sacco_role_assignments
  using (private.has_company_role(company_id, array['owner','admin']::text[]))
  with check (private.has_company_role(company_id, array['owner','admin']::text[]));

alter policy sacco_terms_manage on public.sacco_terms
  using (
    private.has_company_role(company_id, array['owner','admin','manager']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id = sacco_terms.company_id
        and r.user_id = (select auth.uid())
        and r.role = 'chairperson'
    )
  )
  with check (
    private.has_company_role(company_id, array['owner','admin','manager']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id = sacco_terms.company_id
        and r.user_id = (select auth.uid())
        and r.role = 'chairperson'
    )
  );

alter policy sacco_members_insert_staff on public.sacco_members
  with check (
    created_by = (select auth.uid())
    and (
      private.has_company_role(company_id, array['owner','admin','manager']::text[])
      or exists (
        select 1 from public.sacco_role_assignments r
        where r.company_id = sacco_members.company_id
          and r.user_id = (select auth.uid())
          and r.role = any(array['analyst','secretary','mobilizer','chairperson']::text[])
      )
    )
  );

alter policy sacco_members_update_admin_analyst on public.sacco_members
  using (
    private.has_company_role(company_id, array['owner','admin']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id = sacco_members.company_id
        and r.user_id = (select auth.uid())
        and r.role = any(array['analyst','chairperson']::text[])
    )
  )
  with check (
    private.has_company_role(company_id, array['owner','admin']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id = sacco_members.company_id
        and r.user_id = (select auth.uid())
        and r.role = any(array['analyst','chairperson']::text[])
    )
  );

alter policy sacco_savings_submit_pending_deposit on public.sacco_savings_entries
  with check (
    entry_type = 'deposit'
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and submitted_by = (select auth.uid())
    and public.is_company_member(company_id)
    and (
      private.has_company_role(company_id, array['owner','admin','manager','accountant']::text[])
      or exists (
        select 1 from public.sacco_role_assignments r
        where r.company_id = sacco_savings_entries.company_id
          and r.user_id = (select auth.uid())
          and r.role = any(array['analyst','secretary','mobilizer']::text[])
      )
    )
  );

alter policy sacco_welfare_contribution_record on public.sacco_welfare_entries
  with check (
    entry_type = 'contribution'
    and status = 'confirmed'
    and created_by = (select auth.uid())
    and reviewed_by = (select auth.uid())
    and reviewed_at is not null
    and (
      private.has_company_role(company_id, array['owner','admin','manager','accountant']::text[])
      or exists (
        select 1 from public.sacco_role_assignments r
        where r.company_id = sacco_welfare_entries.company_id
          and r.user_id = (select auth.uid())
          and r.role = any(array['chairperson','secretary']::text[])
      )
    )
  );

alter policy sacco_withdrawals_submit on public.sacco_withdrawal_requests
  with check (
    status = 'pending'
    and reviewed_by is null
    and paid_at is null
    and paid_by is null
    and requested_by = (select auth.uid())
    and (
      exists (
        select 1 from public.sacco_members m
        where m.id = sacco_withdrawal_requests.member_id
          and m.portal_user_id = (select auth.uid())
      )
      or (
        public.is_company_member(company_id)
        and (
          private.has_company_role(company_id, array['owner','admin','manager','accountant']::text[])
          or exists (
            select 1 from public.sacco_role_assignments r
            where r.company_id = sacco_withdrawal_requests.company_id
              and r.user_id = (select auth.uid())
              and r.role = any(array['analyst','secretary','mobilizer']::text[])
          )
        )
      )
    )
  );

commit;
