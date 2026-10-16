-- Persist the random salt used to hash camera QR/pairing payloads.
alter table public.business_cameras
  add column if not exists pairing_code_salt text;
