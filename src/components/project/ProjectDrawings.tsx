import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Eye, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

interface Drawing {
  id: string;
  title: string;
  category: string;
  custom_category?: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number;
  uploaded_by: string;
  created_at: string;
  uploader_name?: string;
}

interface ProjectDrawingsProps {
  projectId: string;
  organizationId: string;
}

const DRAWING_CATEGORIES = [
  "Architectural",
  "Structural", 
  "Electrical",
  "Plumbing",
  "HVAC",
  "Elevation",
  "Floor Plan",
  "3D Render",
  "Other"
];

export const ProjectDrawings = ({ projectId, organizationId }: ProjectDrawingsProps) => {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    category: "",
    custom_category: "",
    file: null as File | null
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchDrawings();
  }, [projectId]);

  const fetchDrawings = async () => {
    try {
      const { data, error } = await supabase
        .from("drawings")
        .select(`
          *,
          uploader:profiles(first_name, last_name, email)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const drawingsWithUploaderNames = data?.map(drawing => ({
        ...drawing,
        uploader_name: drawing.uploader?.first_name && drawing.uploader?.last_name
          ? `${drawing.uploader.first_name} ${drawing.uploader.last_name}`
          : drawing.uploader?.email || "Unknown"
      })) || [];

      setDrawings(drawingsWithUploaderNames);
    } catch (error) {
      console.error("Error fetching drawings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch drawings",
        variant: "destructive",
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
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    try {
      // Get current user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) throw new Error("User profile not found");

      // Upload file to storage
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${organizationId}/${projectId}/${Date.now()}_${uploadForm.file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("drawings")
        .upload(fileName, uploadForm.file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from("drawings")
        .getPublicUrl(fileName);

      // Save drawing record to database
      const { error: dbError } = await supabase
        .from("drawings")
        .insert({
          project_id: projectId,
          organization_id: organizationId,
          title: uploadForm.title,
          category: uploadForm.category,
          custom_category: uploadForm.category === "Other" ? uploadForm.custom_category : null,
          file_name: uploadForm.file.name,
          file_url: publicUrl,
          file_type: uploadForm.file.type,
          file_size: uploadForm.file.size,
          uploaded_by: profile.id
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Drawing uploaded successfully",
      });

      setIsUploadDialogOpen(false);
      setUploadForm({ title: "", category: "", custom_category: "", file: null });
      fetchDrawings();
    } catch (error) {
      console.error("Error uploading drawing:", error);
      toast({
        title: "Error",
        description: "Failed to upload drawing",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (drawing: Drawing) => {
    try {
      // Extract the file path from the URL (everything after the bucket name)
      const filePath = drawing.file_url.includes('/public/drawings/') 
        ? drawing.file_url.split('/public/drawings/')[1]
        : drawing.file_url.split('/drawings/')[1];
      
      const { data, error } = await supabase.storage
        .from("drawings")
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = drawing.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading drawing:", error);
      toast({
        title: "Error",
        description: "Failed to download drawing",
        variant: "destructive",
      });
    }
  };

  const handleView = (drawing: Drawing) => {
    window.open(drawing.file_url, '_blank');
  };

  const handleDelete = async (drawing: Drawing) => {
    if (!confirm("Are you sure you want to delete this drawing?")) return;

    try {
      // Delete from storage
      await supabase.storage
        .from("drawings")
        .remove([drawing.file_url.split('/drawings/')[1]]);

      // Delete from database
      const { error } = await supabase
        .from("drawings")
        .delete()
        .eq("id", drawing.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Drawing deleted successfully",
      });

      fetchDrawings();
    } catch (error) {
      console.error("Error deleting drawing:", error);
      toast({
        title: "Error",
        description: "Failed to delete drawing",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Project Drawings</h2>
          <p className="text-muted-foreground">
            Manage project drawings and technical documents
          </p>
        </div>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Drawing
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload New Drawing</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="Enter drawing title"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select 
                  value={uploadForm.category} 
                  onValueChange={(value) => setUploadForm({ ...uploadForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {DRAWING_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {uploadForm.category === "Other" && (
                <div>
                  <Label htmlFor="custom_category">Custom Category *</Label>
                  <Input
                    id="custom_category"
                    value={uploadForm.custom_category}
                    onChange={(e) => setUploadForm({ ...uploadForm, custom_category: e.target.value })}
                    placeholder="Enter custom category"
                    required
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="file">File (PDF/Image) *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.svg"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
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

      {drawings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No drawings uploaded yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Upload your first drawing to get started
            </p>
            <Button onClick={() => setIsUploadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Drawing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {drawings.map((drawing) => (
            <Card key={drawing.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg truncate" title={drawing.title}>
                  {drawing.title}
                </CardTitle>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium">Category:</span>{" "}
                    {drawing.category === "Other" && drawing.custom_category
                      ? drawing.custom_category
                      : drawing.category}
                  </p>
                  <p>
                    <span className="font-medium">Uploaded by:</span>{" "}
                    {drawing.uploader_name}
                  </p>
                  <p>
                    <span className="font-medium">Date:</span>{" "}
                    {format(new Date(drawing.created_at), "MMM dd, yyyy")}
                  </p>
                  <p>
                    <span className="font-medium">Size:</span>{" "}
                    {formatFileSize(drawing.file_size)}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleView(drawing)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(drawing)}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(drawing)}
                    className="w-full mt-2"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};