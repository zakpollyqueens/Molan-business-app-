-- Preserve the invited Circle member's username and phone on their user profile.
begin;

alter table public.user_profiles
  add column if not exists username text;

create index if not exists user_profiles_username_idx
  on public.user_profiles (lower(username))
  where username is not null and length(trim(username)) > 0;

create or replace function public.complete_sacco_circle_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_inv public.sacco_circle_invitation_details%rowtype;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Create an account or sign in to accept this invitation'; end if;
  select lower(u.email) into v_email from auth.users u where u.id=auth.uid();
  select * into v_inv
  from public.sacco_circle_invitation_details
  where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
    and expires_at>now()
  for update;
  if not found then return jsonb_build_object('ok',false,'message','Circle invitation not found or expired'); end if;
  if v_inv.email<>coalesce(v_email,'') then raise exception 'Sign in with the email address this invitation was sent to'; end if;
  if v_inv.accepted_by is not null and v_inv.accepted_by<>auth.uid() then raise exception 'This invitation has already been used'; end if;
  if not exists(select 1 from public.company_members cm where cm.company_id=v_inv.company_id and cm.user_id=auth.uid() and cm.status='active') then
    raise exception 'Accept the workspace invitation before activating your Circle role';
  end if;
  if v_inv.role='chairperson' and exists(select 1 from public.sacco_role_assignments r where r.company_id=v_inv.company_id and r.role='chairperson' and r.user_id<>auth.uid()) then
    raise exception 'A chairperson is already assigned to this Circle';
  end if;
  insert into public.sacco_role_assignments(company_id,user_id,role,assigned_by)
  values(v_inv.company_id,auth.uid(),v_inv.role,v_inv.created_by)
  on conflict(company_id,user_id,role) do nothing;

  insert into public.user_profiles(user_id,display_name,phone,username)
  values(auth.uid(),v_inv.full_name,v_inv.phone,v_inv.username)
  on conflict(user_id) do update set
    display_name=excluded.display_name,
    phone=excluded.phone,
    username=excluded.username,
    updated_at=now();

  update public.sacco_circle_invitation_details
    set accepted_by=auth.uid(),accepted_at=coalesce(accepted_at,now())
    where id=v_inv.id;
  return jsonb_build_object('ok',true,'role',v_inv.role,'department',v_inv.department,'company_id',v_inv.company_id);
end;
$$;

revoke all on function public.complete_sacco_circle_invitation(text) from public, anon;
grant execute on function public.complete_sacco_circle_invitation(text) to authenticated;

commit;
