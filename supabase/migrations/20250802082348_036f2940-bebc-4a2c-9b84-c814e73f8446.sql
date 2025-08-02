-- Create a storage bucket for drawings
INSERT INTO storage.buckets (id, name, public) VALUES ('drawings', 'drawings', false);

-- Create drawings table
CREATE TABLE public.drawings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  custom_category TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

-- Create policies for drawings
CREATE POLICY "Users can view drawings in their organization" 
ON public.drawings 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create drawings in their organization" 
ON public.drawings 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update drawings" 
ON public.drawings 
FOR UPDATE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'pm' OR drawings.uploaded_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Admins and PMs can delete drawings" 
ON public.drawings 
FOR DELETE 
USING (
  organization_id = get_user_organization_id() AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'pm')
  )
);

-- Create storage policies for drawings bucket
CREATE POLICY "Users can view drawings in their organization" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'drawings' AND 
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload drawings in their organization" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'drawings' AND 
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins and PMs can update drawings" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'drawings' AND 
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins and PMs can delete drawings" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'drawings' AND 
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM profiles 
    WHERE user_id = auth.uid() 
    AND (role = 'admin' OR role = 'pm')
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_drawings_updated_at
BEFORE UPDATE ON public.drawings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();