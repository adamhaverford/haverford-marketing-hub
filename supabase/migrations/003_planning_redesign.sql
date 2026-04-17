-- ============================================================
-- Haverford Marketing Hub — Planning Redesign Tables (Phase 4)
-- Run this in the Supabase SQL editor
-- ============================================================

-- ----------------------------------------------------------------
-- planning_topics
-- ----------------------------------------------------------------
create table if not exists public.planning_topics (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands(id) on delete cascade,
  month        text not null,  -- format: 'YYYY-MM'
  type         text not null check (type in ('evergreen', 'promotional')),
  title        text not null,
  description  text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  status       text not null default 'proposed'
               check (status in ('proposed', 'approved', 'declined')),
  actioned_by  uuid references public.profiles(id) on delete set null,
  actioned_at  timestamptz,
  action_comment text
);

alter table public.planning_topics enable row level security;

create policy "Authenticated users can view planning topics"
  on public.planning_topics for select
  using (auth.role() = 'authenticated');

create policy "Marketing users can insert planning topics"
  on public.planning_topics for insert
  with check (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'marketing'
    )
  );

create policy "Authenticated users can update planning topics"
  on public.planning_topics for update
  using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- planning_topic_comments
-- ----------------------------------------------------------------
create table if not exists public.planning_topic_comments (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references public.planning_topics(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comment    text not null,
  created_at timestamptz not null default now()
);

alter table public.planning_topic_comments enable row level security;

create policy "Authenticated users can view topic comments"
  on public.planning_topic_comments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert topic comments"
  on public.planning_topic_comments for insert
  with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- planning_designs
-- ----------------------------------------------------------------
create table if not exists public.planning_designs (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands(id) on delete cascade,
  month        text not null,  -- format: 'YYYY-MM'
  type         text not null check (type in ('evergreen', 'promotional')),
  file_url     text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  uploaded_at  timestamptz not null default now(),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'declined')),
  actioned_by  uuid references public.profiles(id) on delete set null,
  actioned_at  timestamptz,
  is_current   boolean not null default true
);

alter table public.planning_designs enable row level security;

create policy "Authenticated users can view planning designs"
  on public.planning_designs for select
  using (auth.role() = 'authenticated');

create policy "Marketing users can insert planning designs"
  on public.planning_designs for insert
  with check (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'marketing'
    )
  );

create policy "Authenticated users can update planning designs"
  on public.planning_designs for update
  using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- planning_design_comments
-- ----------------------------------------------------------------
create table if not exists public.planning_design_comments (
  id         uuid primary key default gen_random_uuid(),
  design_id  uuid not null references public.planning_designs(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  comment    text not null,
  created_at timestamptz not null default now()
);

alter table public.planning_design_comments enable row level security;

create policy "Authenticated users can view design comments"
  on public.planning_design_comments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert design comments"
  on public.planning_design_comments for insert
  with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- Storage bucket for design uploads
-- Create manually in Supabase Dashboard → Storage → New bucket
-- Name: planning-designs, Public: true
-- ----------------------------------------------------------------
