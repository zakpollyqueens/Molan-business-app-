-- Store short-lived signed preview links for private website drafts.
alter table public.website_service_build_jobs
  add column if not exists preview_url text;

comment on column public.website_service_build_jobs.preview_url is
  'Short-lived signed URL for the private draft preview; never the production delivery URL.';
