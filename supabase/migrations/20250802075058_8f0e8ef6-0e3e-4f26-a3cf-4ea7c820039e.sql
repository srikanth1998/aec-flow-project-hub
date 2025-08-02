-- Update project_proposals table to support array for scope_of_work
ALTER TABLE public.project_proposals 
ALTER COLUMN scope_of_work TYPE text[];