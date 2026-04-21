-- Allow 'dismissal' entity_type in notification_clicks for dismiss buttons
alter table notification_clicks
  drop constraint if exists notification_clicks_entity_type_check;

alter table notification_clicks
  add constraint notification_clicks_entity_type_check
    check (entity_type in ('topic', 'design', 'dismissal'));
