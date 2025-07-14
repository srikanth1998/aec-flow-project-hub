-- Create enum for project types
CREATE TYPE public.project_type AS ENUM (
  'residential_construction',
  'commercial_construction', 
  'infrastructure',
  'renovation',
  'design_only',
  'engineering_analysis',
  'permit_drawings',
  'landscape_design'
);

-- Create enum for project status
CREATE TYPE public.project_status AS ENUM (
  'planning',
  'design_phase',
  'permitting',
  'construction',
  'inspection',
  'completed',
  'on_hold',
  'cancelled'
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type public.project_type NOT NULL,
  status public.project_status NOT NULL DEFAULT 'planning',
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  project_address TEXT,
  estimated_budget DECIMAL(12,2),
  actual_budget DECIMAL(12,2),
  start_date DATE,
  estimated_completion_date DATE,
  actual_completion_date DATE,
  project_manager_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (project_manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policies for projects access
CREATE POLICY "Users can view projects in their organization" 
ON public.projects 
FOR SELECT 
USING (organization_id IN (
  SELECT profiles.organization_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Users can create projects in their organization" 
ON public.projects 
FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT profiles.organization_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Project managers and admins can update projects" 
ON public.projects 
FOR UPDATE 
USING (organization_id IN (
  SELECT profiles.organization_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND (profiles.role = 'admin' OR profiles.role = 'pm')
));

CREATE POLICY "Admins can delete projects" 
ON public.projects 
FOR DELETE 
USING (organization_id IN (
  SELECT profiles.organization_id 
  FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'admin'
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();