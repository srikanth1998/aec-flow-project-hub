import { Button } from "@/components/ui/button";
import { 
  Database,
  ExternalLink
} from "lucide-react";

interface ProjectDocumentsProps {
  projectId: string;
  organizationId: string;
}

export const ProjectDocuments = ({ projectId, organizationId }: ProjectDocumentsProps) => {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Documents</h2>
          <p className="text-muted-foreground">Manage project documents and files</p>
        </div>
      </div>

      {/* Setup Required Message */}
      <div className="text-center py-12">
        <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Database Setup Required</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          The documents feature requires database setup. Please run the SQL migration to create the documents table and storage bucket.
        </p>
        
        <div className="bg-muted/50 p-6 rounded-lg max-w-3xl mx-auto text-left">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">SQL Migration Required</h4>
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://supabase.com/dashboard/project/ailhzwkcrvilqphweses/sql/new" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Open SQL Editor <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
          
          <div className="bg-background p-4 rounded border overflow-x-auto">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
{`-- Create documents table for project file management
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies for documents access
CREATE POLICY "Users can view documents in their organization" 
ON public.documents 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create documents in their organization" 
ON public.documents 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins and PMs can update documents" 
ON public.documents 
FOR UPDATE 
USING ((organization_id = get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND ((profiles.role = 'admin'::user_role) OR (profiles.role = 'pm'::user_role) OR (uploaded_by IN ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())))))));

CREATE POLICY "Admins and PMs can delete documents" 
ON public.documents 
FOR DELETE 
USING ((organization_id = get_user_organization_id()) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND ((profiles.role = 'admin'::user_role) OR (profiles.role = 'pm'::user_role) OR (uploaded_by IN ( SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())))))));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for documents
CREATE POLICY "Users can view their organization documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

CREATE POLICY "Users can upload documents for their organization" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

CREATE POLICY "Users can update their organization documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);

CREATE POLICY "Users can delete their organization documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_organization_id()::text);`}
            </pre>
          </div>
          
          <p className="text-sm text-muted-foreground mt-4">
            After running this SQL, refresh the page to use the Documents feature.
          </p>
        </div>
      </div>
    </div>
  );
};