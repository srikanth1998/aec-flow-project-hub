import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Upload,
  FileText,
  Download,
  Trash2,
  Plus,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  title: string;
  category: string;
  description?: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
  uploader_name?: string;
}

interface ProjectDocumentsProps {
  projectId: string;
  organizationId: string;
}

const DOCUMENT_CATEGORIES = [
  "Contracts",
  "Drawings", 
  "Specifications",
  "Photos",
  "Reports",
  "Permits",
  "Invoices",
  "Other"
];

export const ProjectDocuments = ({ projectId, organizationId }: ProjectDocumentsProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    category: "",
    description: "",
    file: null as File | null
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  const fetchDocuments = async () => {
    try {
      console.log("Fetching documents for project:", projectId);
      
      // First get documents
      const { data: documentsData, error: documentsError } = await supabase
        .from("documents" as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (documentsError) {
        console.error("Documents fetch error:", documentsError);
        throw documentsError;
      }

      // Then get profiles for uploaders
      const uploaderIds = documentsData?.map((doc: any) => doc.uploaded_by).filter(Boolean) || [];
      
      let profilesData: any[] = [];
      if (uploaderIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", uploaderIds);

        if (profilesError) {
          console.error("Profiles fetch error:", profilesError);
        } else {
          profilesData = profiles || [];
        }
      }

      // Combine data
      const documentsWithNames = documentsData?.map((doc: any) => {
        const profile = profilesData.find(p => p.id === doc.uploaded_by);
        return {
          ...doc,
          uploader_name: profile 
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Unknown"
            : "Unknown"
        };
      }) || [];

      setDocuments(documentsWithNames);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Failed to fetch documents",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title || !uploadForm.category) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Upload file to storage
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${organizationId}/${projectId}/${Date.now()}_${uploadForm.file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, uploadForm.file);

      if (uploadError) throw uploadError;

      // Store the storage path (not public URL since bucket is private)
      const storagePath = fileName;

      // Insert document record
      const { error: insertError } = await supabase
        .from("documents" as any)
        .insert({
          project_id: projectId,
          organization_id: organizationId,
          title: uploadForm.title,
          category: uploadForm.category,
          description: uploadForm.description || null,
          file_name: uploadForm.file.name,
          file_url: storagePath, // Store storage path, not public URL
          file_type: uploadForm.file.type,
          file_size: uploadForm.file.size,
          uploaded_by: profile.id
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Document uploaded successfully"
      });

      setUploadForm({ title: "", category: "", description: "", file: null });
      setIsDialogOpen(false);
      fetchDocuments();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error", 
        description: "Failed to upload document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewDocument = async (fileUrl: string) => {
    try {
      // Extract storage path from full URL if needed
      const storagePath = fileUrl.startsWith('http') 
        ? fileUrl.split('/documents/')[1] 
        : fileUrl;
      
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 60); // URL valid for 60 seconds

      if (error) throw error;
      
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error("View error:", error);
      toast({
        title: "Error",
        description: "Failed to open document",
        variant: "destructive"
      });
    }
  };

  const handleDownloadDocument = async (fileUrl: string, fileName: string) => {
    try {
      // Extract storage path from full URL if needed
      const storagePath = fileUrl.startsWith('http') 
        ? fileUrl.split('/documents/')[1] 
        : fileUrl;
        
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(storagePath, 60); // URL valid for 60 seconds

      if (error) throw error;

      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (documentId: string, fileUrl: string) => {
    try {
      // Extract storage path from full URL if needed
      const storagePath = fileUrl.startsWith('http') 
        ? fileUrl.split('/documents/')[1] 
        : fileUrl;
        
      // Delete from storage
      await supabase.storage.from("documents").remove([storagePath]);

      // Delete from database
      const { error } = await supabase
        .from("documents" as any)
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document deleted successfully"
      });
      
      fetchDocuments();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Documents</h2>
            <p className="text-muted-foreground">Manage project documents and files</p>
          </div>
        </div>
        <div className="text-center py-12">
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Documents</h2>
          <p className="text-muted-foreground">Manage project documents and files</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter document title"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select 
                  value={uploadForm.category} 
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description (optional)"
                />
              </div>
              
              <div>
                <Label htmlFor="file">File *</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  required
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents yet</h3>
          <p className="text-muted-foreground mb-6">
            Upload your first document to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {documents.map((document) => (
            <Card key={document.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{document.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                        {document.category}
                      </span>
                      <span>{document.file_name}</span>
                      <span>{formatFileSize(document.file_size)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDocument(document.file_url)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadDocument(document.file_url, document.file_name)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(document.id, document.file_url)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {document.description && (
                <CardContent className="pt-0">
                  <p className="text-muted-foreground">{document.description}</p>
                </CardContent>
              )}
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground">
                  Uploaded by {document.uploader_name} on {new Date(document.created_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};