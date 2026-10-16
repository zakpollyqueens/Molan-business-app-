-- Workspace lifecycle controls for Molan Business.
-- "delete" is a reversible archive to preserve financial and operational audit history.
alter table public.company_profiles
  add column if not exists status text not null default 'active';

alter table public.company_profiles
  add column if not exists deleted_at timestamptz;

update public.company_profiles
set status = 'active'
where status is null or status not in ('active','inactive','deleted');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_profiles_status_check'
      and conrelid = 'public.company_profiles'::regclass
  ) then
    alter table public.company_profiles
      add constraint company_profiles_status_check
      check (status in ('active','inactive','deleted'));
  end if;
end $$;

create or replace function public.manage_company_workspace_status(
  p_company_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_action not in ('activate','deactivate','delete') then
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
    v_status := 'deleted';
  end if;

  if not found then
    raise exception 'Business workspace not found';
  end if;

  return jsonb_build_object(
    'company_id', p_company_id,
    'status', v_status,
    'action', p_action,
    'updated_at', now()
  );
end;
$$;

revoke all on function public.manage_company_workspace_status(uuid,text) from public;
grant execute on function public.manage_company_workspace_status(uuid,text) to authenticated;
