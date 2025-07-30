import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Edit, 
  Trash2, 
  Eye, 
  Upload,
  File,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  Folder
} from "lucide-react";
import { format } from "date-fns";

interface Document {
  id: string;
  project_id: string;
  organization_id: string;
  title: string;
  category: string;
  description?: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  uploader_name?: string;
}

interface ProjectDocumentsProps {
  projectId: string;
  organizationId: string;
}

const DOCUMENT_CATEGORIES = [
  "Contract",
  "Permit",
  "Bill",
  "Agreement", 
  "Plan",
  "Specification",
  "Invoice",
  "Receipt",
  "Report",
  "Other"
];

export const ProjectDocuments = ({ projectId, organizationId }: ProjectDocumentsProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    title: "",
    category: "",
    description: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentUser();
    fetchDocuments();
  }, [projectId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setCurrentUser(profile);
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          profiles!documents_uploaded_by_fkey(first_name, last_name)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const documentsWithUploaderName = data?.map(doc => ({
        ...doc,
        uploader_name: doc.profiles 
          ? `${doc.profiles.first_name || ''} ${doc.profiles.last_name || ''}`.trim()
          : 'Unknown User'
      })) || [];

      setDocuments(documentsWithUploaderName);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    if (fileType.includes('image')) return <FileImage className="h-8 w-8 text-blue-500" />;
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
    if (fileType.includes('video')) return <FileVideo className="h-8 w-8 text-purple-500" />;
    if (fileType.includes('audio')) return <FileAudio className="h-8 w-8 text-orange-500" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileUpload = async () => {
    if (!uploadForm.file || !currentUser) return;

    setUploading(true);
    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${organizationId}/${projectId}/${Date.now()}-${uploadForm.file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadForm.file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          project_id: projectId,
          organization_id: organizationId,
          title: uploadForm.title || uploadForm.file.name,
          category: uploadForm.category,
          description: uploadForm.description,
          file_name: uploadForm.file.name,
          file_url: urlData.publicUrl,
          file_type: uploadForm.file.type,
          file_size: uploadForm.file.size,
          uploaded_by: currentUser.id
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document uploaded successfully.",
      });

      setShowUploadDialog(false);
      setUploadForm({ file: null, title: "", category: "", description: "" });
      fetchDocuments();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Error",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleEditDocument = async () => {
    if (!editingDocument) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update({
          title: editingDocument.title,
          category: editingDocument.category,
          description: editingDocument.description
        })
        .eq('id', editingDocument.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document updated successfully.",
      });

      setEditingDocument(null);
      fetchDocuments();
    } catch (error) {
      console.error("Error updating document:", error);
      toast({
        title: "Error",
        description: "Failed to update document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (document: Document) => {
    try {
      // Delete from storage
      const filePath = document.file_url.split('/documents/')[1];
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) console.warn("Storage delete error:", storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Document deleted successfully.",
      });

      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = (document: Document) => {
    window.open(document.file_url, '_blank');
  };

  const handleDownloadDocument = async (document: Document) => {
    try {
      const response = await fetch(document.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = document.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "Failed to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded-lg"></div>
            ))}
          </div>
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
        <Button onClick={() => setShowUploadDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents uploaded</h3>
          <p className="text-muted-foreground mb-4">Get started by uploading your first document</p>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {documents.map((document) => (
            <Card key={document.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(document.file_type)}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {document.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {formatFileSize(document.file_size)}
                      </CardDescription>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="w-fit text-xs">
                  {document.category}
                </Badge>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-3">
                {document.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {document.description}
                  </p>
                )}
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Uploaded by: {document.uploader_name}</div>
                  <div>{format(new Date(document.created_at), 'MMM dd, yyyy')}</div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleViewDocument(document)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleDownloadDocument(document)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setEditingDocument(document)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDeleteDocument(document)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a new document to this project
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadForm(prev => ({
                      ...prev,
                      file,
                      title: prev.title || file.name.split('.')[0]
                    }));
                  }
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt"
              />
            </div>
            
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Document title (defaults to filename)"
              />
            </div>
            
            <div>
              <Label htmlFor="category">Category</Label>
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
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the document"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleFileUpload} 
              disabled={!uploadForm.file || !uploadForm.category || uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDocument} onOpenChange={() => setEditingDocument(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document information
            </DialogDescription>
          </DialogHeader>
          
          {editingDocument && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editingDocument.title}
                  onChange={(e) => setEditingDocument(prev => prev ? { ...prev, title: e.target.value } : null)}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select 
                  value={editingDocument.category} 
                  onValueChange={(value) => setEditingDocument(prev => prev ? { ...prev, category: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingDocument.description || ""}
                  onChange={(e) => setEditingDocument(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDocument(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditDocument}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};