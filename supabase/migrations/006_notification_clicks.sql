create table notification_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete cascade,
  entity_id   text not null,
  entity_type text not null check (entity_type in ('topic', 'design')),
  clicked_at  timestamptz default now(),
  unique(user_id, entity_id, entity_type)
);

alter table notification_clicks enable row level security;

create policy "Users can manage own notification clicks"
  on notification_clicks for all
  to authenticated
  using (user_id = (select id from profiles where user_id = auth.uid()))
  with check (user_id = (select id from profiles where user_id = auth.uid()));
