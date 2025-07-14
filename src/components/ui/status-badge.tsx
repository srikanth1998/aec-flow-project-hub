import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "pending" | "progress" | "complete" | "overdue" | "not-started" | "on-hold";
  children: React.ReactNode;
  className?: string;
}

const statusConfig = {
  "not-started": {
    className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    dot: "bg-gray-400"
  },
  "pending": {
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    dot: "bg-orange-400"
  },
  "progress": {
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-400"
  },
  "complete": {
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    dot: "bg-green-400"
  },
  "overdue": {
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-400"
  },
  "on-hold": {
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    dot: "bg-yellow-400"
  }
};

export const StatusBadge = ({ status, children, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border-0",
        config.className,
        className
      )}
    >
      <div 
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          config.dot
        )}
      />
      {children}
    </Badge>
  );
};