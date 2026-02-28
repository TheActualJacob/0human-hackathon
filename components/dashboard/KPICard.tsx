import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  highlight?: boolean;
}

export default function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  className,
  highlight
}: KPICardProps) {
  return (
    <Card className={cn(
      "p-6 transition-all hover:shadow-lg",
      highlight && "ai-glow border-primary/50",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 pt-1">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-green-500" : "text-red-500"
              )}>
                {trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn(
          "rounded-lg p-3",
          highlight ? "bg-primary/10" : "bg-secondary"
        )}>
          <Icon className={cn(
            "h-5 w-5",
            highlight ? "text-primary" : "text-muted-foreground"
          )} />
        </div>
      </div>
    </Card>
  );
}