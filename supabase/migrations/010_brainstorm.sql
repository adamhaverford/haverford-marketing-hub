create table brainstorm_ideas (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  brand_id uuid references brands(id) on delete cascade,
  topic_type text check (topic_type in ('evergreen', 'promotional')) default null,
  status text not null default 'new' check (status in ('new', 'proceeded', 'declined')),
  proceeded_to_month text default null,
  proceeded_to_topic_id uuid references planning_topics(id) default null,
  -- references profiles(id) for consistency with planning_topics and to enable joins
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table brainstorm_ideas enable row level security;

create policy "Authenticated users can do everything" on brainstorm_ideas
  for all using (auth.role() = 'authenticated');
