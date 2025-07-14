import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  onClick?: () => void;
  className?: string;
}

export const ActionCard = ({ 
  title, 
  description, 
  icon, 
  badge, 
  badgeVariant = "default",
  onClick, 
  className 
}: ActionCardProps) => {
  return (
    <Card 
      className={cn(
        "group transition-all duration-300 hover:shadow-lg hover:-translate-y-2 cursor-pointer border-0 shadow-soft bg-gradient-to-br from-card to-card/90 hover:from-card hover:to-primary/5",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
            {icon}
          </div>
          {badge && (
            <Badge variant={badgeVariant} className="ml-2">
              {badge}
            </Badge>
          )}
        </div>
        <div>
          <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors duration-300">
            {title}
          </CardTitle>
          <CardDescription className="mt-2 leading-relaxed">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
};