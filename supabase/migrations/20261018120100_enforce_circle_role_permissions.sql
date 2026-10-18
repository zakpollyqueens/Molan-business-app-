-- Enforce the Circle's explicit responsibilities at the database layer.
begin;

alter policy sacco_terms_manage on public.sacco_terms
  using (
    private.has_company_role(company_id, array['owner','admin','manager']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id=sacco_terms.company_id and r.user_id=(select auth.uid())
        and r.role in ('analyst','chairperson')
    )
  )
  with check (
    private.has_company_role(company_id, array['owner','admin']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id=sacco_terms.company_id and r.user_id=(select auth.uid())
        and r.role in ('analyst','chairperson')
    )
  );

-- Only analyst, secretary and mobilizer may register members; chairperson is oversight-only.
alter policy sacco_members_insert_staff on public.sacco_members
  with check (
    created_by=(select auth.uid())
    and public.is_company_member(company_id)
    and (
      private.has_company_role(company_id,array['owner','admin','manager']::text[])
      or exists (
        select 1 from public.sacco_role_assignments r
        where r.company_id=sacco_members.company_id and r.user_id=(select auth.uid())
          and r.role in ('analyst','secretary','mobilizer')
      )
    )
  );

-- Analyst and chairperson may update Circle settings/member profile data; secretaries and mobilizers may not.
alter policy sacco_members_update_admin_analyst on public.sacco_members
  using (
    private.has_company_role(company_id,array['owner','admin','manager']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id=sacco_members.company_id and r.user_id=(select auth.uid())
        and r.role in ('analyst','chairperson')
    )
  )
  with check (
    private.has_company_role(company_id,array['owner','admin']::text[])
    or exists (
      select 1 from public.sacco_role_assignments r
      where r.company_id=sacco_members.company_id and r.user_id=(select auth.uid())
        and r.role in ('analyst','chairperson')
    )
  );

commit;
