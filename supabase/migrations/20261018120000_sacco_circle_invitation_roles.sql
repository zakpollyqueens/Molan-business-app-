-- Circle-specific invitations and role activation.
-- Invitation tokens are stored only as SHA-256 hashes; Circle roles are activated
-- only after the invited user has accepted the normal workspace invitation.
begin;

create table if not exists public.sacco_circle_invitation_details (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company_profiles(id) on delete cascade,
  email text not null,
  full_name text not null check (length(trim(full_name)) between 2 and 180),
  username text not null check (length(trim(username)) between 2 and 40),
  phone text not null check (length(trim(phone)) between 5 and 40),
  role text not null check (role in ('analyst','secretary','mobilizer','chairperson')),
  department text not null check (department in ('finance','general_operations')),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.sacco_circle_invitation_details enable row level security;
revoke all on public.sacco_circle_invitation_details from anon, authenticated;

-- One designated chairperson per Circle workspace.
create unique index if not exists sacco_one_chairperson_per_company
  on public.sacco_role_assignments(company_id) where role = 'chairperson';

create or replace function public.create_sacco_circle_invitation(
  p_company_id uuid,
  p_email text,
  p_full_name text,
  p_username text,
  p_phone text,
  p_role text,
  p_department text,
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_department text := lower(trim(coalesce(p_department,'')));
begin
  if auth.uid() is null then raise exception 'Sign in before inviting a Circle member'; end if;
  if not exists (
    select 1 from public.company_members cm
    where cm.company_id = p_company_id and cm.user_id = auth.uid() and cm.status = 'active'
  ) then raise exception 'Active workspace membership required'; end if;
  if not (
    exists(select 1 from public.sacco_role_assignments r where r.company_id=p_company_id and r.user_id=auth.uid() and r.role='analyst')
    or exists(select 1 from public.company_members cm where cm.company_id=p_company_id and cm.user_id=auth.uid() and cm.status='active' and cm.role in ('owner','admin'))
  ) then raise exception 'Only the Circle analyst or workspace owner can invite Circle members'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  if length(trim(coalesce(p_full_name,''))) < 2 or length(trim(coalesce(p_username,''))) < 2 or length(trim(coalesce(p_phone,''))) < 5 then
    raise exception 'Name, username and phone number are required';
  end if;
  if p_role not in ('analyst','secretary','mobilizer','chairperson') then raise exception 'Invalid Circle role'; end if;
  if v_department not in ('finance','general_operations') then raise exception 'Choose Finance or General Operations'; end if;
  if length(coalesce(p_token,'')) < 32 then raise exception 'Invalid invitation token'; end if;
  if p_role='chairperson' and exists(select 1 from public.sacco_role_assignments r where r.company_id=p_company_id and r.role='chairperson') then
    raise exception 'This Circle already has an assigned chairperson. Complete chairperson succession before inviting another.';
  end if;

  -- The standard invitation creates the secure, expiring workspace invitation.
  -- Use a limited base workspace role; the scoped Circle role is stored separately.
  perform public.create_company_invitation(
    p_company_id, v_email, 'staff', p_token, null
  );

  insert into public.sacco_circle_invitation_details(
    company_id,email,full_name,username,phone,role,department,token_hash,created_by
  ) values (
    p_company_id,v_email,trim(p_full_name),trim(p_username),trim(p_phone),
    p_role,v_department,encode(extensions.digest(p_token,'sha256'),'hex'),auth.uid()
  );
  return jsonb_build_object('ok',true,'role',p_role,'department',v_department);
end;
$$;

revoke all on function public.create_sacco_circle_invitation(uuid,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_sacco_circle_invitation(uuid,text,text,text,text,text,text,text) to authenticated;

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
  update public.sacco_circle_invitation_details
    set accepted_by=auth.uid(),accepted_at=coalesce(accepted_at,now())
    where id=v_inv.id;
  return jsonb_build_object('ok',true,'role',v_inv.role,'department',v_inv.department,'company_id',v_inv.company_id);
end;
$$;

revoke all on function public.complete_sacco_circle_invitation(text) from public, anon;
grant execute on function public.complete_sacco_circle_invitation(text) to authenticated;

commit;
