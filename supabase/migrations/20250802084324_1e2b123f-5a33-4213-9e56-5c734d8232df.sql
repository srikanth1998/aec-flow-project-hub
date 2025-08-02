-- Drop existing policies for drawings bucket if they exist
DROP POLICY IF EXISTS "Authenticated users can view drawings" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload drawings to their organization folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update drawings in their organization folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete drawings in their organization folder" ON storage.objects;

-- Create updated RLS policies for the drawings bucket that allow viewing files
CREATE POLICY "Users can view drawings in their organization" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'drawings' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can upload drawings to their organization" 
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

CREATE POLICY "Users can update drawings in their organization" 
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

CREATE POLICY "Users can delete drawings in their organization" 
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