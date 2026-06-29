-- Add 'misc' to the planning_topics section check constraint.
-- The section column was added directly in Supabase; this migration
-- drops and recreates the constraint to include the new value.

ALTER TABLE public.planning_topics
DROP CONSTRAINT IF EXISTS planning_topics_section_check;

ALTER TABLE public.planning_topics
ADD CONSTRAINT planning_topics_section_check
CHECK (section IN ('subject_line', 'hero', 'crosssell', 'tip', 'spotlight', 'misc'));
