import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProjectProposalProps {
  projectId: string;
  organizationId: string;
  project: any;
  onProjectUpdate: (updatedProject: any) => void;
}

interface ProposalData {
  id?: string;
  work_summary: string;
  scope_of_work: string[];
  project_lead: string;
  site_engineer: string;
  supervisor: string;
  approval_status: string;
  approved_by: string | null;
  approval_date: string | null;
}

export const ProjectProposal = ({ projectId, organizationId, project }: ProjectProposalProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState<ProposalData>({
    work_summary: "Work summary to be provided.",
    scope_of_work: ["Scope of work to be defined."],
    project_lead: "TBD",
    site_engineer: "TBD", 
    supervisor: "TBD",
    approval_status: "pending",
    approved_by: null,
    approval_date: null,
  });
  const [newScopeItem, setNewScopeItem] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadProposal();
  }, [projectId]);

  const loadProposal = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_proposals')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error) {
        console.error("Error loading proposal:", error);
        toast({
          title: "Error",
          description: "Failed to load proposal data",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setProposal({
          id: data.id,
          work_summary: data.work_summary || "Work summary to be provided.",
          scope_of_work: data.scope_of_work || ["Scope of work to be defined."],
          project_lead: data.project_lead || "TBD",
          site_engineer: data.site_engineer || "TBD",
          supervisor: data.supervisor || "TBD",
          approval_status: data.approval_status || "pending",
          approved_by: data.approved_by,
          approval_date: data.approval_date,
        });
      }
    } catch (error) {
      console.error("Error loading proposal:", error);
      toast({
        title: "Error",
        description: "Failed to load proposal data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProposal = async () => {
    try {
      setSaving(true);

      const proposalData = {
        project_id: projectId,
        organization_id: organizationId,
        work_summary: proposal.work_summary,
        scope_of_work: proposal.scope_of_work,
        project_lead: proposal.project_lead,
        site_engineer: proposal.site_engineer,
        supervisor: proposal.supervisor,
        approval_status: proposal.approval_status,
      };

      let result;
      if (proposal.id) {
        // Update existing proposal
        result = await supabase
          .from('project_proposals')
          .update(proposalData)
          .eq('id', proposal.id)
          .select()
          .single();
      } else {
        // Create new proposal
        result = await supabase
          .from('project_proposals')
          .insert(proposalData)
          .select()
          .single();
      }

      if (result.error) {
        console.error("Error saving proposal:", result.error);
        toast({
          title: "Error", 
          description: "Failed to save proposal",
          variant: "destructive",
        });
        return;
      }

      setProposal(prev => ({ ...prev, id: result.data.id }));
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

  const addScopeItem = () => {
    if (newScopeItem.trim()) {
      setProposal(prev => ({
        ...prev,
        scope_of_work: [...prev.scope_of_work, newScopeItem.trim()]
      }));
      setNewScopeItem("");
    }
  };

  const removeScopeItem = (index: number) => {
    setProposal(prev => ({
      ...prev,
      scope_of_work: prev.scope_of_work.filter((_, i) => i !== index)
    }));
  };

  const updateScopeItem = (index: number, value: string) => {
    setProposal(prev => ({
      ...prev,
      scope_of_work: prev.scope_of_work.map((item, i) => i === index ? value : item)
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading proposal...</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Project Proposal</h2>
          <p className="text-muted-foreground">Edit your project proposal details</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(proposal.approval_status)}>
            {proposal.approval_status.charAt(0).toUpperCase() + proposal.approval_status.slice(1)}
          </Badge>
          <Button onClick={saveProposal} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Proposal"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Project Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold">Client Name</Label>
                <p className="text-sm">{project?.client_name || "N/A"}</p>
              </div>
              <div>
                <Label className="font-semibold">Location</Label>
                <p className="text-sm">{project?.project_address || "N/A"}</p>
              </div>
              <div>
                <Label className="font-semibold">Start Date</Label>
                <p className="text-sm">{project?.start_date || "TBD"}</p>
              </div>
              <div>
                <Label className="font-semibold">Completion Date</Label>
                <p className="text-sm">{project?.estimated_completion_date || "TBD"}</p>
              </div>
              <div>
                <Label className="font-semibold">Estimated Budget</Label>
                <p className="text-sm">{project?.estimated_budget ? `$${project.estimated_budget}` : "TBD"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Work Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={proposal.work_summary}
              onChange={(e) => setProposal(prev => ({ ...prev, work_summary: e.target.value }))}
              placeholder="Describe the overall work to be performed..."
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* Scope of Work */}
        <Card>
          <CardHeader>
            <CardTitle>Scope of Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {proposal.scope_of_work.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Textarea
                  value={item}
                  onChange={(e) => updateScopeItem(index, e.target.value)}
                  placeholder="Scope item..."
                  className="flex-1 min-h-[60px]"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => removeScopeItem(index)}
                  disabled={proposal.scope_of_work.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Separator />
            
            <div className="flex gap-2">
              <Textarea
                value={newScopeItem}
                onChange={(e) => setNewScopeItem(e.target.value)}
                placeholder="Add new scope item..."
                className="flex-1 min-h-[60px]"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addScopeItem}
                disabled={!newScopeItem.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Team Assignment */}
        <Card>
          <CardHeader>
            <CardTitle>Team Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="project-lead">Project Lead</Label>
                <Input
                  id="project-lead"
                  value={proposal.project_lead}
                  onChange={(e) => setProposal(prev => ({ ...prev, project_lead: e.target.value }))}
                  placeholder="Project Lead Name"
                />
              </div>
              <div>
                <Label htmlFor="site-engineer">Site Engineer</Label>
                <Input
                  id="site-engineer"
                  value={proposal.site_engineer}
                  onChange={(e) => setProposal(prev => ({ ...prev, site_engineer: e.target.value }))}
                  placeholder="Site Engineer Name"
                />
              </div>
              <div>
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  value={proposal.supervisor}
                  onChange={(e) => setProposal(prev => ({ ...prev, supervisor: e.target.value }))}
                  placeholder="Supervisor Name"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Information */}
        {(proposal.approved_by || proposal.approval_date) && (
          <Card>
            <CardHeader>
              <CardTitle>Approval Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {proposal.approved_by && (
                <div>
                  <Label className="font-semibold">Approved By</Label>
                  <p className="text-sm">{proposal.approved_by}</p>
                </div>
              )}
              {proposal.approval_date && (
                <div>
                  <Label className="font-semibold">Approval Date</Label>
                  <p className="text-sm">{new Date(proposal.approval_date).toLocaleDateString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};