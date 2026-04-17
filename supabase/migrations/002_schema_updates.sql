-- ============================================================
-- Haverford Marketing Hub — Schema Updates (Phase 3)
-- Run this in the Supabase SQL editor
-- ============================================================

-- Add email column to profiles (for user management UI)
alter table public.profiles add column if not exists email text;

-- Update handle_new_user trigger to capture email
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, role, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'marketing'),
    new.email
  )
  on conflict (user_id) do update set
    email = excluded.email;
  return new;
end;
$$;

-- Backfill email for existing profiles (requires auth schema access)
-- Run this manually if needed:
-- update public.profiles p
-- set email = u.email
-- from auth.users u
-- where u.id = p.user_id and p.email is null;

-- Add unique constraint to performance_snapshots for upsert support
alter table public.performance_snapshots
  add constraint if not exists performance_snapshots_brand_month_unique
  unique (brand_id, month);

-- Allow marketing users to update performance snapshots (for upsert)
-- (already covered by the existing "all" policy, no change needed)

-- Activity log table for recent activity feed
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid references public.brands(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "Authenticated users can view activity log"
  on public.activity_log for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert activity log"
  on public.activity_log for insert
  with check (auth.role() = 'authenticated');
