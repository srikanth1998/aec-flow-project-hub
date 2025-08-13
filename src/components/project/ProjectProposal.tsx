import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";
import { saveAs } from "file-saver";

interface ProjectProposalProps {
  projectId: string;
  organizationId: string;
  project: any;
  onProjectUpdate: (updatedProject: any) => void;
}

export const ProjectProposal = ({ project }: ProjectProposalProps) => {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();


  const createWordProposal = async () => {
    console.log('🚀 Starting Word document creation...');
    
    try {
      setSaving(true);
      console.log('📋 Project data:', project);
      
      // Test basic imports first
      console.log('🔍 Testing imports...');
      console.log('Document:', typeof Document);
      console.log('Packer:', typeof Packer);
      console.log('saveAs:', typeof saveAs);
      
      // Create a simple Word document first
      console.log('📄 Creating simple Document object...');
      const doc = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "PROJECT PROPOSAL",
                    bold: true,
                    size: 32,
                  }),
                ],
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              
              new Paragraph({
                children: [
                  new TextRun({
                    text: project?.name || "Untitled Project",
                    bold: true,
                    size: 28,
                  }),
                ],
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 },
              }),

              new Paragraph({
                text: `Client: ${project?.client_name || "N/A"}`,
                spacing: { after: 100 },
              }),

              new Paragraph({
                text: `Location: ${project?.project_address || "N/A"}`,
                spacing: { after: 100 },
              }),

              new Paragraph({
                text: `Generated on ${new Date().toLocaleDateString()}`,
                spacing: { before: 400 },
              }),
            ],
          },
        ],
      });

      console.log('✅ Document object created successfully');

      // Generate and download the Word document
      console.log('📦 Converting document to blob...');
      const blob = await Packer.toBlob(doc);
      console.log('✅ Blob created successfully, size:', blob.size);
      
      const fileName = `${project?.name || 'Proposal'}_${new Date().toISOString().split('T')[0]}.docx`;
      console.log('💾 Saving file:', fileName);
      
      saveAs(blob, fileName);
      console.log('✅ File saved successfully');
      
      toast({
        title: "Success",
        description: "Word proposal document created and downloaded",
      });
      
    } catch (error) {
      console.error("❌ Error creating Word document:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      toast({
        title: "Error",
        description: `Failed to create Word document: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Finishing document creation process');
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Project Proposal</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Word Proposal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <Button 
              type="button" 
              onClick={createWordProposal} 
              disabled={saving}
              size="lg"
              className="w-full max-w-md"
            >
              <FileText className="h-5 w-5 mr-2" />
              {saving ? "Creating..." : "Create Word Proposal"}
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Generate a professional Word document with your project information including client details, timeline, and basic structure.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};