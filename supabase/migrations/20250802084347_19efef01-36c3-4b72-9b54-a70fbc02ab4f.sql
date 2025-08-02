-- Drop all existing policies for drawings bucket
DROP POLICY IF EXISTS "Users can view drawings in their organization" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Users can upload drawings to their organization" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Users can update drawings in their organization" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Users can delete drawings in their organization" ON storage.objects CASCADE;

-- Create new RLS policies for the drawings bucket
CREATE POLICY "drawings_select_policy" 
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

CREATE POLICY "drawings_insert_policy" 
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

CREATE POLICY "drawings_update_policy" 
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

CREATE POLICY "drawings_delete_policy" 
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