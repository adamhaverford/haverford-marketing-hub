alter table planning_topics add column if not exists sort_order integer not null default 0;

create index if not exists planning_topics_sort_order_idx on planning_topics (brand_id, month, type, sort_order);
