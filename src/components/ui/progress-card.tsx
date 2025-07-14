import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressCardProps {
  title: string;
  progress: number;
  target?: number;
  unit?: string;
  description?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "destructive";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const progressColors = {
  primary: "bg-primary",
  secondary: "bg-secondary", 
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive"
};

export const ProgressCard = ({ 
  title, 
  progress, 
  target, 
  unit = "%", 
  description,
  color = "primary",
  size = "md",
  className 
}: ProgressCardProps) => {
  const displayValue = target ? `${progress}${unit} / ${target}${unit}` : `${progress}${unit}`;
  const progressPercentage = target ? (progress / target) * 100 : progress;
  
  return (
    <Card className={cn("border-0 shadow-soft bg-card", className)}>
      <CardHeader className={cn(
        "pb-2",
        size === "sm" && "pb-1",
        size === "lg" && "pb-4"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn(
            "font-medium text-muted-foreground",
            size === "sm" && "text-sm",
            size === "md" && "text-sm",
            size === "lg" && "text-base"
          )}>
            {title}
          </CardTitle>
          <span className={cn(
            "font-bold text-foreground",
            size === "sm" && "text-lg",
            size === "md" && "text-xl",
            size === "lg" && "text-2xl"
          )}>
            {displayValue}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Progress 
          value={progressPercentage} 
          className={cn(
            "w-full",
            size === "sm" && "h-1",
            size === "md" && "h-2",
            size === "lg" && "h-3"
          )}
        />
        {description && (
          <p className="text-xs text-muted-foreground mt-2">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};