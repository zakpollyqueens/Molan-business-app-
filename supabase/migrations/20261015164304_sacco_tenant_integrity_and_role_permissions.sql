-- Enforce tenant-consistent member and term references; allow admin role removal.
alter table public.sacco_members add constraint sacco_members_company_id_id_key unique(company_id,id);
alter table public.sacco_terms add constraint sacco_terms_company_id_id_key unique(company_id,id);
alter table public.sacco_withdrawal_requests add constraint sacco_withdrawals_company_id_id_key unique(company_id,id);
alter table public.sacco_savings_entries drop constraint sacco_savings_entries_member_id_fkey;
alter table public.sacco_savings_entries add constraint sacco_savings_member_company_fkey foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete restrict;
alter table public.sacco_savings_entries drop constraint sacco_savings_entries_term_id_fkey;
alter table public.sacco_savings_entries add constraint sacco_savings_term_company_fkey foreign key(company_id,term_id) references public.sacco_terms(company_id,id) on delete restrict;
alter table public.sacco_withdrawal_requests drop constraint sacco_withdrawal_requests_member_id_fkey;
alter table public.sacco_withdrawal_requests add constraint sacco_withdrawal_member_company_fkey foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete restrict;
alter table public.sacco_withdrawal_requests drop constraint sacco_withdrawal_requests_term_id_fkey;
alter table public.sacco_withdrawal_requests add constraint sacco_withdrawal_term_company_fkey foreign key(company_id,term_id) references public.sacco_terms(company_id,id) on delete restrict;
alter table public.sacco_member_reviews drop constraint sacco_member_reviews_member_id_fkey;
alter table public.sacco_member_reviews add constraint sacco_reviews_member_company_fkey foreign key(company_id,member_id) references public.sacco_members(company_id,id) on delete cascade;
alter table public.sacco_member_reviews drop constraint sacco_member_reviews_term_id_fkey;
alter table public.sacco_member_reviews add constraint sacco_reviews_term_company_fkey foreign key(company_id,term_id) references public.sacco_terms(company_id,id) on delete restrict;
alter table public.sacco_savings_entries drop constraint sacco_savings_entries_withdrawal_request_id_fkey;
alter table public.sacco_savings_entries add constraint sacco_savings_withdrawal_company_fkey foreign key(company_id,withdrawal_request_id) references public.sacco_withdrawal_requests(company_id,id) on delete restrict;
grant delete on public.sacco_role_assignments to authenticated;
