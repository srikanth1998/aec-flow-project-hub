-- Create the drawings storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('drawings', 'drawings', true);

-- Create RLS policies for the drawings bucket
CREATE POLICY "Authenticated users can view drawings" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'drawings' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload drawings to their organization folder" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'drawings' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update drawings in their organization folder" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'drawings' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete drawings in their organization folder" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'drawings' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);