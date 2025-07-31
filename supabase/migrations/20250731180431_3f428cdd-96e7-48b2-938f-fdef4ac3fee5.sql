-- Create project_proposals table
CREATE TABLE public.project_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  work_summary TEXT,
  scope_of_work TEXT,
  project_lead TEXT,
  site_engineer TEXT,
  supervisor TEXT,
  proposal_file_url TEXT,
  proposal_file_name TEXT,
  approved_by TEXT,
  approval_date DATE,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.project_proposals ENABLE ROW LEVEL SECURITY;

-- Create policies for project_proposals
CREATE POLICY "Users can view proposals in their organization" 
ON public.project_proposals 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create proposals in their organization" 
ON public.project_proposals 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update proposals" 
ON public.project_proposals 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'pm')
  )
);

CREATE POLICY "Admins can delete proposals" 
ON public.project_proposals 
FOR DELETE 
USING (
  organization_id = get_user_organization_id() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_project_proposals_updated_at
BEFORE UPDATE ON public.project_proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();