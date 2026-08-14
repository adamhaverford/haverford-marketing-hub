-- Add Aussie Grazers section IDs to the planning_topics section check constraint.
-- NOTE: This migration is NOT auto-applied and must be run manually in the Supabase SQL editor.

ALTER TABLE public.planning_topics
DROP CONSTRAINT IF EXISTS planning_topics_section_check;

ALTER TABLE public.planning_topics
ADD CONSTRAINT planning_topics_section_check
CHECK (section IN ('subject_line', 'hero', 'crosssell', 'tip', 'spotlight', 'misc',
                   'intro', 'education_tips', 'did_you_know', 'customer_review', 'horse_of_month', 'upcoming_events'));
