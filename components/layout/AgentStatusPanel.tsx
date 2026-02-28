'use client';

import { Brain, Activity, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import useStore from "@/lib/store/useStore";
import { Card } from "@/components/ui/card";

export default function AgentStatusPanel() {
  const { agentMode, autonomyLevel, activityFeed } = useStore();
  
  // Count recent AI activities
  const recentAIActivities = activityFeed
    .filter(activity => activity.aiGenerated)
    .filter(activity => {
      const timeDiff = Date.now() - new Date(activity.timestamp).getTime();
      return timeDiff < 3600000; // Last hour
    }).length;

  return (
    <Card className="p-4 ai-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Agent Status</h3>
        </div>
        <div className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          agentMode === 'active' ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {agentMode.toUpperCase()}
        </div>
      </div>

      <div className="space-y-3">
        {/* Autonomy Level */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Autonomy Level</span>
            <span className="text-sm font-medium">{autonomyLevel}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${autonomyLevel}%` }}
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Actions (1h)</span>
          </div>
          <span className="text-sm font-medium">{recentAIActivities}</span>
        </div>

        {/* Escalations */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Escalations</span>
          </div>
          <span className="text-sm font-medium text-yellow-500">2 pending</span>
        </div>
      </div>
    </Card>
  );
}