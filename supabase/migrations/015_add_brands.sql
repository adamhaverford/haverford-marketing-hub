-- Add new brands with Klaviyo accounts to show in the Email Schedule grid.
-- Uses name-based duplicate guard since there's no unique constraint on name.

insert into public.brands (name, description, color, klaviyo_account, active)
select name, description, color, klaviyo_account, true
from (values
  ('Catnets NZ',       'Catnets New Zealand',   '#7B2D8B', 'catnets-nz'),
  ('Catnets UK',       'Catnets United Kingdom', '#9C27B0', 'catnets-uk'),
  ('Catnetting US',    'Catnetting USA',         '#6A1B9A', 'catnetting-us'),
  ('Gutzbusta NZ',     'Gutzbusta New Zealand',  '#2E7D32', 'gutzbusta-nz'),
  ('Gutzbusta UK',     'Gutzbusta United Kingdom','#388E3C', 'gutzbusta-uk'),
  ('Gutzbusta US',     'Gutzbusta USA',           '#43A047', 'gutzbusta-us'),
  ('Quatra Netting',   'Quatra Netting Australia','#00897B', 'quatra-netting-au'),
  ('Quatra Sports',    'Quatra Sports Australia', '#1976D2', 'quatra-sports-au'),
  ('Rope Central',     'Rope Central Australia',  '#8D6E63', 'rope-central-au'),
  ('Shade Matters',    'Shade Matters Australia', '#F57F17', 'shade-matters-au')
) as v(name, description, color, klaviyo_account)
where not exists (
  select 1 from public.brands b where b.name = v.name
);
