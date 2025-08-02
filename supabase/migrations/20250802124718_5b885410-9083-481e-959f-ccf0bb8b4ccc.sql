-- Make the drawings bucket public so files can be viewed directly
UPDATE storage.buckets 
SET public = true 
WHERE id = 'drawings';

-- Drop existing RLS policies and create simpler ones for public access
DROP POLICY IF EXISTS "drawings_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "drawings_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "drawings_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "drawings_delete_policy" ON storage.objects;

-- Create new policies for public viewing and authenticated user management
CREATE POLICY "Anyone can view drawings" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'drawings');

CREATE POLICY "Authenticated users can upload drawings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'drawings' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update drawings" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'drawings' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete drawings" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'drawings' 
  AND auth.role() = 'authenticated'
);