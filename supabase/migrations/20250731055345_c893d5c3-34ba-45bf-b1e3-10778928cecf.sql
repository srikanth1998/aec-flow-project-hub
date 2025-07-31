-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);

-- Create storage policies for document access
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