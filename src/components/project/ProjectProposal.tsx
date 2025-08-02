import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, Eye, Upload, X, Save, Plus, Trash2 } from "lucide-react";

interface ProjectProposalProps {
  projectId: string;
  organizationId: string;
  project: any;
  onProjectUpdate: (updatedProject: any) => void;
}

export const ProjectProposal = ({ projectId, organizationId, project, onProjectUpdate }: ProjectProposalProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [projectData, setProjectData] = useState({
    name: project?.name || "",
    client_name: project?.client_name || "",
    project_address: project?.project_address || "",
    start_date: project?.start_date || "",
    estimated_completion_date: project?.estimated_completion_date || "",
    estimated_budget: project?.estimated_budget || "",
  });
  const [proposalData, setProposalData] = useState({
    work_summary: "",
    scope_of_work: [] as string[],
    project_lead: "",
    site_engineer: "",
    supervisor: "",
    proposal_file_url: "",
    proposal_file_name: "",
    approved_by: "",
    approval_date: "",
    approval_status: "pending" as "approved" | "pending" | "rejected",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProposal();
  }, [projectId]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("project_proposals")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setProposal(data);
        setProposalData({
          work_summary: data.work_summary || "",
          scope_of_work: Array.isArray(data.scope_of_work) ? data.scope_of_work : (data.scope_of_work ? [data.scope_of_work] : [""]),
          project_lead: data.project_lead || "",
          site_engineer: data.site_engineer || "",
          supervisor: data.supervisor || "",
          proposal_file_url: data.proposal_file_url || "",
          proposal_file_name: data.proposal_file_name || "",
          approved_by: data.approved_by || "",
          approval_date: data.approval_date || "",
          approval_status: (data.approval_status as "approved" | "pending" | "rejected") || "pending",
        });
      }
    } catch (error) {
      console.error("Error fetching proposal:", error);
      toast({
        title: "Error",
        description: "Failed to load proposal data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProjectData = async () => {
    try {
      setSaving(true);
      const { data, error } = await supabase
        .from("projects")
        .update({
          name: projectData.name,
          client_name: projectData.client_name,
          project_address: projectData.project_address,
          start_date: projectData.start_date || null,
          estimated_completion_date: projectData.estimated_completion_date || null,
          estimated_budget: projectData.estimated_budget ? parseFloat(projectData.estimated_budget) : null,
        })
        .eq("id", projectId)
        .select()
        .single();

      if (error) throw error;

      onProjectUpdate(data);
      toast({
        title: "Success",
        description: "Project information updated successfully",
      });
    } catch (error) {
      console.error("Error updating project:", error);
      toast({
        title: "Error",
        description: "Failed to update project information",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveProposalData = async () => {
    try {
      setSaving(true);
      
      const proposalPayload = {
        project_id: projectId,
        organization_id: organizationId,
        ...proposalData,
        approval_date: proposalData.approval_date || null,
      };

      let result;
      if (proposal) {
        result = await supabase
          .from("project_proposals")
          .update(proposalPayload)
          .eq("id", proposal.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from("project_proposals")
          .insert(proposalPayload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setProposal(result.data);
      toast({
        title: "Success",
        description: "Proposal saved successfully",
      });
    } catch (error) {
      console.error("Error saving proposal:", error);
      toast({
        title: "Error",
        description: "Failed to save proposal",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes('pdf') && !file.type.includes('doc') && !file.type.includes('docx')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, DOC, or DOCX file",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `proposal_${projectId}_${Date.now()}.${fileExt}`;
      const filePath = `${organizationId}/${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setProposalData(prev => ({
        ...prev,
        proposal_file_url: filePath,
        proposal_file_name: file.name,
      }));

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleViewFile = async () => {
    if (!proposalData.proposal_file_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(proposalData.proposal_file_url, 60);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error("View error:", error);
      toast({
        title: "Error",
        description: "Failed to open file",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFile = async () => {
    if (!proposalData.proposal_file_url) return;

    try {
      setSaving(true);
      
      const { error } = await supabase.storage
        .from('documents')
        .remove([proposalData.proposal_file_url]);

      if (error) throw error;

      setProposalData(prev => ({
        ...prev,
        proposal_file_url: "",
        proposal_file_name: "",
      }));

      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addTask = () => {
    setProposalData(prev => ({
      ...prev,
      scope_of_work: [...prev.scope_of_work, ""]
    }));
  };

  const updateTask = (index: number, value: string) => {
    setProposalData(prev => ({
      ...prev,
      scope_of_work: prev.scope_of_work.map((task, i) => i === index ? value : task)
    }));
  };

  const removeTask = (index: number) => {
    setProposalData(prev => ({
      ...prev,
      scope_of_work: prev.scope_of_work.filter((_, i) => i !== index)
    }));
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "approved": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Project Proposal</h2>
        <div className="flex gap-2">
          <Button onClick={saveProjectData} disabled={saving} variant="outline">
            <Save className="h-4 w-4 mr-2" />
            Save Project Info
          </Button>
          <Button onClick={saveProposalData} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            Save Proposal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Information */}
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="project-title">Project Title</Label>
              <Input
                id="project-title"
                value={projectData.name}
                onChange={(e) => setProjectData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter project title"
              />
            </div>
            
            <div>
              <Label htmlFor="client-name">Client Name</Label>
              <Input
                id="client-name"
                value={projectData.client_name}
                onChange={(e) => setProjectData(prev => ({ ...prev, client_name: e.target.value }))}
                placeholder="Enter client name"
              />
            </div>
            
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={projectData.project_address}
                onChange={(e) => setProjectData(prev => ({ ...prev, project_address: e.target.value }))}
                placeholder="Enter project location"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={projectData.start_date}
                  onChange={(e) => setProjectData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={projectData.estimated_completion_date}
                  onChange={(e) => setProjectData(prev => ({ ...prev, estimated_completion_date: e.target.value }))}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="estimated-budget">Estimated Budget</Label>
              <Input
                id="estimated-budget"
                type="number"
                step="0.01"
                value={projectData.estimated_budget}
                onChange={(e) => setProjectData(prev => ({ ...prev, estimated_budget: e.target.value }))}
                placeholder="Enter estimated budget"
              />
            </div>
          </CardContent>
        </Card>

        {/* Work Summary & Scope */}
        <Card>
          <CardHeader>
            <CardTitle>Work Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="work-summary">Work Summary</Label>
              <Textarea
                id="work-summary"
                value={proposalData.work_summary}
                onChange={(e) => setProposalData(prev => ({ ...prev, work_summary: e.target.value }))}
                placeholder="Enter a brief summary of the work to be performed"
                rows={4}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Scope of Work</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTask}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              </div>
              <div className="space-y-2">
                {proposalData.scope_of_work.length === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addTask}
                    className="w-full h-12 border-dashed"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first task
                  </Button>
                ) : (
                  proposalData.scope_of_work.map((task, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={task}
                        onChange={(e) => updateTask(index, e.target.value)}
                        placeholder={`Task ${index + 1}`}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeTask(index)}
                        className="h-10 w-10 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Team */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="project-lead">Project Lead</Label>
              <Input
                id="project-lead"
                value={proposalData.project_lead}
                onChange={(e) => setProposalData(prev => ({ ...prev, project_lead: e.target.value }))}
                placeholder="Enter project lead name"
              />
            </div>
            
            <div>
              <Label htmlFor="site-engineer">Site Engineer</Label>
              <Input
                id="site-engineer"
                value={proposalData.site_engineer}
                onChange={(e) => setProposalData(prev => ({ ...prev, site_engineer: e.target.value }))}
                placeholder="Enter site engineer name"
              />
            </div>
            
            <div>
              <Label htmlFor="supervisor">Supervisor</Label>
              <Input
                id="supervisor"
                value={proposalData.supervisor}
                onChange={(e) => setProposalData(prev => ({ ...prev, supervisor: e.target.value }))}
                placeholder="Enter supervisor name"
              />
            </div>
          </CardContent>
        </Card>

        {/* Proposal Document & Approval */}
        <Card>
          <CardHeader>
            <CardTitle>Document & Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Proposal Document</Label>
              <div className="space-y-2">
                {proposalData.proposal_file_name ? (
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <span className="flex-1 text-sm">{proposalData.proposal_file_name}</span>
                    <Button size="sm" variant="outline" onClick={handleViewFile}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDeleteFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="proposal-upload"
                  />
                  <Label htmlFor="proposal-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" className="w-full">
                      <Upload className="h-4 w-4 mr-2" />
                      {proposalData.proposal_file_name ? "Replace Document" : "Upload Document"}
                    </Button>
                  </Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="approved-by">Approved By</Label>
              <Input
                id="approved-by"
                value={proposalData.approved_by}
                onChange={(e) => setProposalData(prev => ({ ...prev, approved_by: e.target.value }))}
                placeholder="Enter approver name"
              />
            </div>
            
            <div>
              <Label htmlFor="approval-date">Approval Date</Label>
              <Input
                id="approval-date"
                type="date"
                value={proposalData.approval_date}
                onChange={(e) => setProposalData(prev => ({ ...prev, approval_date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="approval-status">Status</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={proposalData.approval_status}
                  onValueChange={(value: "approved" | "pending" | "rejected") => 
                    setProposalData(prev => ({ ...prev, approval_status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant={getStatusBadgeVariant(proposalData.approval_status)}>
                  {proposalData.approval_status.charAt(0).toUpperCase() + proposalData.approval_status.slice(1)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};