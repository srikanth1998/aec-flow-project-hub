-- Add foreign key relationship between expenses and projects
ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_project_id 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add foreign key relationship between expenses and organizations  
ALTER TABLE public.expenses 
ADD CONSTRAINT fk_expenses_organization_id 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;