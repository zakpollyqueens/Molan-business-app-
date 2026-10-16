-- Allow authenticated users to evaluate the company membership helper used by RLS policies.
-- The helper only returns whether auth.uid() is an active member of the requested company.
-- Its definition uses SECURITY DEFINER with an empty search_path and explicitly matches auth.uid().
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
