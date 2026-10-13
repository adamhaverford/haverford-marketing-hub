create table if not exists email_schedule (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  week_date   date not null,
  status      text not null default 'empty' check (status in ('empty', 'planned', 'scheduled', 'sent')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (brand_id, week_date)
);

alter table email_schedule enable row level security;

create policy "Authenticated users can read email_schedule"
  on email_schedule for select
  to authenticated
  using (true);

create policy "Authenticated users can upsert email_schedule"
  on email_schedule for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update email_schedule"
  on email_schedule for update
  to authenticated
  using (true);

create policy "Authenticated users can delete email_schedule"
  on email_schedule for delete
  to authenticated
  using (true);
