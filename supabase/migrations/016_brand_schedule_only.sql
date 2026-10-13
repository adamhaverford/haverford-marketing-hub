-- Flag brands that exist only for the Email Schedule grid,
-- not the full planning/brand flow.
alter table public.brands add column if not exists schedule_only boolean not null default false;

-- Mark the 10 newly added brands as schedule-only
update public.brands set schedule_only = true
where klaviyo_account in (
  'catnets-nz', 'catnets-uk', 'catnetting-us',
  'gutzbusta-nz', 'gutzbusta-uk', 'gutzbusta-us',
  'quatra-netting-au', 'quatra-sports-au', 'rope-central-au', 'shade-matters-au'
);
