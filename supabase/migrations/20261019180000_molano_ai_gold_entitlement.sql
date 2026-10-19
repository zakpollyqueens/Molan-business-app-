-- Gold-only entitlement check for Molano AI Business.
-- Access is scoped to an authenticated user with active membership in the requested workspace.
create or replace function public.check_molano_ai_gold_entitlement(p_company_id uuid)
returns table(has_access boolean, plan_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_company_id is null or not exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  ) then
    raise exception 'Active workspace membership required';
  end if;

  return query
    select
      (cs.status = 'active' and cs.plan_code = 'gold' and cs.expires_at is not null and cs.expires_at > now()) as has_access,
      cs.plan_code,
      cs.expires_at
    from public.company_subscriptions cs
    where cs.company_id = p_company_id;

  if not found then
    return query select false, null::text, null::timestamptz;
  end if;
end;
$$;

revoke all on function public.check_molano_ai_gold_entitlement(uuid) from public, anon;
grant execute on function public.check_molano_ai_gold_entitlement(uuid) to authenticated;
