-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view documents in their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to their organization" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents from their organization" ON storage.objects;

-- Create new storage policies for document access
CREATE POLICY "Users can view documents in their organization" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'documents' AND 
  name LIKE (get_user_organization_id()::text || '/%')
);

CREATE POLICY "Users can upload documents to their organization" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'documents' AND 
  name LIKE (get_user_organization_id()::text || '/%')
);

CREATE POLICY "Users can delete documents from their organization" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'documents' AND 
  name LIKE (get_user_organization_id()::text || '/%')
);