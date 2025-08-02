-- Update project_proposals table to support array for scope_of_work
ALTER TABLE public.project_proposals 
ALTER COLUMN scope_of_work TYPE text[] USING 
  CASE 
    WHEN scope_of_work IS NULL THEN NULL
    WHEN scope_of_work = '' THEN ARRAY[]::text[]
    ELSE string_to_array(scope_of_work, E'\n')
  END;