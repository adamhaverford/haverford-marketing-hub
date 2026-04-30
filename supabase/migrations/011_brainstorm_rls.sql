drop policy if exists "Authenticated users can do everything" on brainstorm_ideas;

create policy "All authenticated users see all ideas" on brainstorm_ideas
  for select using (auth.role() = 'authenticated');

create policy "All authenticated users can insert" on brainstorm_ideas
  for insert with check (auth.role() = 'authenticated');

create policy "All authenticated users can update" on brainstorm_ideas
  for update using (auth.role() = 'authenticated');
