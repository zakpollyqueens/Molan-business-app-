-- Secure invitation preview: the invitation token itself is the capability to view this limited invitation summary.
begin;
create or replace function public.get_sacco_circle_invitation_details(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_inv record;
begin
  if length(coalesce(p_token,'')) < 32 then
    return jsonb_build_object('ok',false,'message','This invitation link is invalid.');
  end if;
  select d.email,d.full_name,d.role,d.department,cp.name as company_name,d.accepted_by,d.expires_at
    into v_inv
  from public.sacco_circle_invitation_details d
  join public.company_profiles cp on cp.id=d.company_id
  where d.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
  limit 1;
  if not found or v_inv.expires_at<=now() then
    return jsonb_build_object('ok',false,'message','This invitation is invalid or has expired. Ask the workspace analyst for a new invitation.');
  end if;
  if v_inv.accepted_by is not null then
    return jsonb_build_object('ok',false,'message','This invitation has already been accepted. Sign in to open your workspace.');
  end if;
  return jsonb_build_object('ok',true,'email',v_inv.email,'full_name',v_inv.full_name,'role',v_inv.role,'department',v_inv.department,'company_name',v_inv.company_name);
end;
$$;
revoke all on function public.get_sacco_circle_invitation_details(text) from public;
grant execute on function public.get_sacco_circle_invitation_details(text) to anon, authenticated;
commit;
