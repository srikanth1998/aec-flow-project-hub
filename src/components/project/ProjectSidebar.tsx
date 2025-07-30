import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  CheckSquare, 
  Receipt, 
  PenTool, 
  FolderOpen,
  Settings,
  CreditCard
} from "lucide-react";

interface ProjectSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const sidebarItems = [
  { id: "proposal", label: "Proposal", icon: FileText },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "services", label: "Services", icon: Settings },
  { id: "invoices", label: "Invoices", icon: CreditCard },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "drawings", label: "Drawings", icon: PenTool },
  { id: "documents", label: "Documents", icon: FolderOpen },
];

export const ProjectSidebar = ({ activeTab, onTabChange }: ProjectSidebarProps) => {
  return (
    <aside className="w-64 border-r bg-card">
      <nav className="p-4 space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
          Project Navigation
        </h3>
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start h-10",
                activeTab === item.id && "bg-primary text-primary-foreground"
              )}
              onClick={() => onTabChange(item.id)}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
};