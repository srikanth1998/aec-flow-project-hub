-- Create table for storing project proposals
CREATE TABLE public.project_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'PROJECT PROPOSAL',
  work_summary TEXT DEFAULT 'Work summary to be provided.',
  scope_of_work TEXT DEFAULT 'Scope of work to be defined.',
  project_lead TEXT DEFAULT 'TBD',
  site_engineer TEXT DEFAULT 'TBD',
  supervisor TEXT DEFAULT 'TBD',
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_proposals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view proposals for their organization's projects" 
ON public.project_proposals 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.profiles pr ON pr.id = p.created_by
    WHERE p.id = project_proposals.project_id 
    AND pr.organization_id = (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create proposals for their organization's projects" 
ON public.project_proposals 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.profiles pr ON pr.id = p.created_by
    WHERE p.id = project_proposals.project_id 
    AND pr.organization_id = (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update proposals for their organization's projects" 
ON public.project_proposals 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.profiles pr ON pr.id = p.created_by
    WHERE p.id = project_proposals.project_id 
    AND pr.organization_id = (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_project_proposals_updated_at
BEFORE UPDATE ON public.project_proposals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();