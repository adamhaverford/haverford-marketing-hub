-- ============================================================
-- Haverford Marketing Hub — Initial Schema
-- Run this entire file in the Supabase SQL editor
-- ============================================================

-- ----------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'marketing' check (role in ('marketing', 'stakeholder')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  unique (user_id)
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'marketing')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------
-- brands
-- ----------------------------------------------------------------
create table if not exists public.brands (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  description         text,
  color               text not null default '#1B2B4B',
  klaviyo_account_id  text,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

alter table public.brands enable row level security;

create policy "Authenticated users can view brands"
  on public.brands for select
  using (auth.role() = 'authenticated');

create policy "Marketing users can manage brands"
  on public.brands for all
  using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'marketing'
    )
  );

-- Seed brands
insert into public.brands (name, description, color) values
  ('Haverford AUS', 'Haverford Australia brand', '#1B2B4B'),
  ('Haverford NZ',  'Haverford New Zealand brand', '#1B2B4B'),
  ('Catnets',       'Catnets brand', '#7B2D8B'),
  ('Just Pro Tools','Just Pro Tools brand', '#E8611A')
on conflict do nothing;

-- ----------------------------------------------------------------
-- campaigns
-- ----------------------------------------------------------------
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete cascade,
  title         text not null,
  type          text not null check (type in ('evergreen', 'promotional')),
  month         date,
  status        text not null default 'idea'
                check (status in ('idea','proposed','approved','declined','in_production','scheduled','sent')),
  subject_line  text,
  preview_text  text,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "Authenticated users can view campaigns"
  on public.campaigns for select
  using (auth.role() = 'authenticated');

create policy "Marketing users can manage campaigns"
  on public.campaigns for all
  using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'marketing'
    )
  );

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger campaigns_updated_at
  before update on public.campaigns
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------
-- approvals
-- ----------------------------------------------------------------
create table if not exists public.approvals (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  actioned_by   uuid references public.profiles(id) on delete set null,
  action        text not null check (action in ('approved', 'declined')),
  comment       text,
  actioned_at   timestamptz not null default now()
);

alter table public.approvals enable row level security;

create policy "Authenticated users can view approvals"
  on public.approvals for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert approvals"
  on public.approvals for insert
  with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- design_reviews
-- ----------------------------------------------------------------
create table if not exists public.design_reviews (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.campaigns(id) on delete cascade,
  image_url           text not null,
  uploaded_by         uuid references public.profiles(id) on delete set null,
  uploaded_at         timestamptz not null default now(),
  status              text not null default 'pending'
                      check (status in ('pending', 'approved', 'declined')),
  stakeholder_comment text,
  reviewed_by         uuid references public.profiles(id) on delete set null,
  reviewed_at         timestamptz
);

alter table public.design_reviews enable row level security;

create policy "Authenticated users can view design reviews"
  on public.design_reviews for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can manage design reviews"
  on public.design_reviews for all
  using (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('proposal_submitted', 'design_uploaded')),
  campaign_id   uuid references public.campaigns(id) on delete cascade,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (
    user_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

create policy "Users can update own notifications"
  on public.notifications for update
  using (
    user_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

create policy "Authenticated users can insert notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- performance_snapshots
-- ----------------------------------------------------------------
create table if not exists public.performance_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  brand_id              uuid not null references public.brands(id) on delete cascade,
  campaign_id           uuid references public.campaigns(id) on delete set null,
  month                 date not null,
  open_rate             numeric(5,2),
  click_rate            numeric(5,2),
  click_to_open_rate    numeric(5,2),
  revenue_per_recipient numeric(10,4),
  notes                 text,
  created_at            timestamptz not null default now()
);

alter table public.performance_snapshots enable row level security;

create policy "Authenticated users can view performance snapshots"
  on public.performance_snapshots for select
  using (auth.role() = 'authenticated');

create policy "Marketing users can manage performance snapshots"
  on public.performance_snapshots for all
  using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'marketing'
    )
  );
