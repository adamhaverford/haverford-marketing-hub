-- ============================================================
-- Fix: planning_designs INSERT policy for admin (service_role) client
--
-- Problem: the original INSERT policy checks auth.uid(), which is null
-- when Postgres runs under service_role context with FORCE ROW LEVEL
-- SECURITY enabled. This causes RLS violations even when using the
-- admin/service-role Supabase client.
--
-- Fix: add an explicit service_role policy (WITH CHECK (true)) so
-- the admin client always works, and keep the authenticated-marketing
-- policy as a fallback for direct authenticated calls.
-- ============================================================

-- Drop old single policy
drop policy if exists "Marketing users can insert planning designs" on public.planning_designs;

-- Allow the service_role (admin client, SUPABASE_SERVICE_ROLE_KEY) to insert unconditionally.
-- This bypasses auth.uid() checks that fail under FORCE ROW LEVEL SECURITY.
create policy "Service role can insert planning designs"
  on public.planning_designs
  for insert
  to service_role
  with check (true);

-- Allow authenticated marketing users to insert via the regular client.
-- Role enforcement is also done in application code before this is reached.
create policy "Marketing users can insert planning designs"
  on public.planning_designs
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'marketing'
    )
  );

-- ----------------------------------------------------------------
-- Mirror the same pattern on planning_topics INSERT for consistency
-- ----------------------------------------------------------------
drop policy if exists "Marketing users can insert planning topics" on public.planning_topics;

create policy "Service role can insert planning topics"
  on public.planning_topics
  for insert
  to service_role
  with check (true);

create policy "Marketing users can insert planning topics"
  on public.planning_topics
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role = 'marketing'
    )
  );

-- ----------------------------------------------------------------
-- Also grant service_role explicit UPDATE access (belt-and-suspenders)
-- ----------------------------------------------------------------
drop policy if exists "Authenticated users can update planning designs" on public.planning_designs;

create policy "Service role can update planning designs"
  on public.planning_designs
  for update
  to service_role
  using (true)
  with check (true);

create policy "Authenticated users can update planning designs"
  on public.planning_designs
  for update
  to authenticated
  using (auth.role() = 'authenticated');
