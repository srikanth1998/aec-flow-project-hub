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
    try {
      console.log('🚀 Starting Word document creation...');
      setSaving(true);
      
      console.log('📋 Project data:', project);
      
      // Create a new Word document
      console.log('📄 Creating Document object...');
      const doc = new Document({
        sections: [
          {
            children: [
              // Title
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
              
              // Project Title
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

              // Project Information Section
              new Paragraph({
                children: [
                  new TextRun({
                    text: "PROJECT INFORMATION",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
              }),

              // Project details table
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Client Name:" })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: project?.client_name || "N/A" })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Location:" })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: project?.project_address || "N/A" })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Start Date:" })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: project?.start_date || "TBD" })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Completion Date:" })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: project?.estimated_completion_date || "TBD" })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Estimated Budget:" })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: project?.estimated_budget ? `$${project.estimated_budget}` : "TBD" })],
                      }),
                    ],
                  }),
                ],
              }),

              // Work Summary Section
              new Paragraph({
                children: [
                  new TextRun({
                    text: "WORK SUMMARY",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
              }),

              new Paragraph({
                text: "Work summary to be provided.",
                spacing: { after: 200 },
              }),

              // Scope of Work Section
              new Paragraph({
                children: [
                  new TextRun({
                    text: "SCOPE OF WORK",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
              }),

              new Paragraph({
                text: "Scope of work to be defined.",
                spacing: { after: 100 },
              }),

              // Team Assignment Section
              new Paragraph({
                children: [
                  new TextRun({
                    text: "TEAM ASSIGNMENT",
                    bold: true,
                    size: 24,
                  }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
              }),

              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Project Lead:" })],
                        width: { size: 30, type: WidthType.PERCENTAGE },
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: "TBD" })],
                        width: { size: 70, type: WidthType.PERCENTAGE },
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Site Engineer:" })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: "TBD" })],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph({ text: "Supervisor:" })],
                      }),
                      new TableCell({
                        children: [new Paragraph({ text: "TBD" })],
                      }),
                    ],
                  }),
                ],
              }),

              // Footer
              new Paragraph({
                text: "",
                spacing: { before: 800 },
              }),

              new Paragraph({
                text: `Generated on ${new Date().toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
                spacing: { before: 400 },
              }),
            ],
          },
        ],
      });

      console.log('✅ Document object created successfully');

      // Generate and download the Word document
      console.log('📦 Converting document to buffer...');
      const buffer = await Packer.toBuffer(doc);
      console.log('✅ Buffer created successfully, size:', buffer.byteLength);
      
      const fileName = `${project?.name || 'Proposal'}_${new Date().toISOString().split('T')[0]}.docx`;
      console.log('💾 Saving file:', fileName);
      
      saveAs(new Blob([buffer]), fileName);
      console.log('✅ File saved successfully');
      
      toast({
        title: "Success",
        description: "Word proposal document created and downloaded",
      });
    } catch (error) {
      console.error("Error creating Word document:", error);
      toast({
        title: "Error",
        description: "Failed to create Word document",
        variant: "destructive",
      });
    } finally {
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