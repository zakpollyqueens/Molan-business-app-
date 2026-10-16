-- Require fresh password confirmation and remove all workspace memberships on terminal deletion.
-- Business records are retained for audit, but the deleted workspace is removed from every member's access.
create or replace function public.manage_company_workspace_status(
  p_company_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_status text;
  v_previous_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_action is null or p_action not in ('activate','deactivate','delete') then
    raise exception 'Unsupported workspace action';
  end if;

  if not exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and lower(cm.role) in ('owner','admin')
  ) then
    raise exception 'Only an active workspace owner or administrator may manage business status';
  end if;

  select cp.status into v_previous_status
  from public.company_profiles cp
  where cp.id = p_company_id
  for update;

  if not found then
    raise exception 'Business workspace not found';
  end if;

  if v_previous_status = 'deleted' then
    raise exception 'This business profile has already been deleted and access revoked';
  end if;

  if p_action = 'activate' then
    update public.company_profiles
      set status = 'active', deleted_at = null
      where id = p_company_id;
    v_status := 'active';
  elsif p_action = 'deactivate' then
    update public.company_profiles
      set status = 'inactive', deleted_at = null
      where id = p_company_id;
    v_status := 'inactive';
  else
    update public.company_profiles
      set status = 'deleted', deleted_at = now()
      where id = p_company_id;
    update public.company_members
      set status = 'inactive'
      where company_id = p_company_id and status = 'active';
    v_status := 'deleted';
  end if;

  return jsonb_build_object(
    'company_id', p_company_id,
    'status', v_status,
    'action', p_action,
    'updated_at', now(),
    'access_revoked', p_action = 'delete',
    'records_retained_for_audit', p_action = 'delete'
  );
end;
$$;

revoke all on function public.manage_company_workspace_status(uuid,text) from public, anon;
grant execute on function public.manage_company_workspace_status(uuid,text) to authenticated;
