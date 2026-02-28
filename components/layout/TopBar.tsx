'use client';

import { Bell, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import useStore from "@/lib/store/useStore";

export default function TopBar() {
  const { agentMode, autonomyLevel } = useStore();
  
  return (
    <div className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      {/* Page Title - will be filled by individual pages */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Property Management</h1>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <button className="relative p-2 hover:bg-secondary rounded-lg transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
        </button>
        
        {/* Agent Status Panel */}
        <div className="flex items-center gap-4 rounded-lg bg-card px-4 py-2 ai-glow">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              agentMode === 'active' ? "bg-primary pulse-glow" : "bg-muted"
            )} />
            <span className="text-sm font-medium">
              Agent: {agentMode.charAt(0).toUpperCase() + agentMode.slice(1)}
            </span>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Autonomy:</span>
            <span className="text-sm font-medium text-primary">{autonomyLevel}%</span>
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">2 escalations</span>
          </div>
        </div>
      </div>
    </div>
  );
}