-- Add project_id column to services table
ALTER TABLE public.services 
ADD COLUMN project_id UUID REFERENCES public.projects(id);

-- Update RLS policies to include project_id filtering
DROP POLICY IF EXISTS "Users can view services in their organization" ON public.services;
DROP POLICY IF EXISTS "Users can create services in their organization" ON public.services;
DROP POLICY IF EXISTS "Admins and PMs can update services" ON public.services;
DROP POLICY IF EXISTS "Admins can delete services" ON public.services;

-- Create new RLS policies that consider both organization and project
CREATE POLICY "Users can view services in their project" 
ON public.services 
FOR SELECT 
USING (
  organization_id = get_user_organization_id() AND
  project_id IN (
    SELECT id FROM public.projects 
    WHERE organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Users can create services in their project" 
ON public.services 
FOR INSERT 
WITH CHECK (
  organization_id = get_user_organization_id() AND
  project_id IN (
    SELECT id FROM public.projects 
    WHERE organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Admins and PMs can update services in their organization" 
ON public.services 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id() AND
  project_id IN (
    SELECT id FROM public.projects 
    WHERE organization_id = get_user_organization_id()
  ) AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin'::user_role OR role = 'pm'::user_role)
  )
);

CREATE POLICY "Admins can delete services in their organization" 
ON public.services 
FOR DELETE 
USING (
  organization_id = get_user_organization_id() AND
  project_id IN (
    SELECT id FROM public.projects 
    WHERE organization_id = get_user_organization_id()
  ) AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::user_role
  )
);