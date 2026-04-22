-- Add klaviyo_account column to brands table
alter table brands add column if not exists klaviyo_account text;

-- Performance notes table (per brand+year, replaces per-month snapshot notes)
create table if not exists performance_notes (
  id         uuid primary key default gen_random_uuid(),
  brand_id   uuid references brands(id) on delete cascade,
  year       integer not null,
  notes      text,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now(),
  unique(brand_id, year)
);

alter table performance_notes enable row level security;

create policy "Authenticated users can manage performance notes"
  on performance_notes for all
  to authenticated
  using (true)
  with check (true);

-- Seed klaviyo_account values (adjust WHERE clauses to match your brand names)
update brands set klaviyo_account = 'catnets-au'       where name ilike '%catnets%';
update brands set klaviyo_account = 'haverford'         where name ilike '%haverford aus%' or name ilike '%haverford australia%';
update brands set klaviyo_account = 'justprotools-au'   where name ilike '%just pro tools%' or name ilike '%justprotools%';
update brands set klaviyo_account = 'gutzbusta-au'      where name ilike '%gutzbusta%';
