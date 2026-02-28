'use client';

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ActivityItem } from "@/types";
import { 
  Home, 
  DollarSign, 
  Wrench, 
  FileText,
  Brain,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
}

const activityIcons = {
  maintenance: Wrench,
  rent: DollarSign,
  lease: FileText,
  vendor: Wrench,
  system: Home
};

export default function ActivityFeed({ activities, className }: ActivityFeedProps) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Live Activity Feed</h3>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary pulse-glow" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>
      
      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent activity
          </p>
        ) : (
          activities.map((activity) => {
            const Icon = activityIcons[activity.type];
            
            return (
              <div 
                key={activity.id}
                className={cn(
                  "flex gap-3 p-3 rounded-lg transition-all",
                  activity.aiGenerated && "bg-primary/5 border border-primary/20"
                )}
              >
                <div className={cn(
                  "rounded-lg p-2 shrink-0",
                  activity.aiGenerated ? "bg-primary/10" : "bg-secondary"
                )}>
                  {activity.aiGenerated ? (
                    <Brain className="h-4 w-4 text-primary" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.details}
                  </p>
                </div>
                
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}