'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Search, Filter, Wrench, Clock, CheckCircle, AlertCircle, MessageSquare, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDemoStore } from '@/lib/store/demo';
import { WorkflowTimeline } from '@/components/maintenance/WorkflowTimeline';
import { CommunicationFeed } from '@/components/maintenance/CommunicationFeed';
import { AIDecisionPanel } from '@/components/maintenance/AIDecisionPanel';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WorkflowState } from '@/types';

export default function DemoLandlordMaintenancePage() {
  const { maintenanceRequests, updateMaintenanceStatus, contractors } = useDemoStore();
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [demoWorkflows, setDemoWorkflows] = useState<any[]>([]);

  useEffect(() => {
    // Initialize demo workflows from mock requests
    const initialWorkflows = maintenanceRequests.map(req => ({
      id: `wf-${req.id}`,
      maintenance_request_id: req.id,
      current_state: req.status,
      ai_analysis: {
        category: req.category,
        urgency: req.priority,
        estimated_cost_range: 'medium',
        vendor_required: req.priority === 'high',
        reasoning: 'Analysis based on demo data.',
        confidence_score: 0.95
      },
      communications: [
        {
          id: `c1-${req.id}`,
          sender_type: 'tenant',
          content: req.description,
          created_at: req.created_at
        },
        {
          id: `c2-${req.id}`,
          sender_type: 'system',
          content: 'AI analysis complete. Owner notified.',
          created_at: new Date(new Date(req.created_at).getTime() + 60000).toISOString()
        }
      ],
      state_history: ['SUBMITTED', req.status]
    }));
    setDemoWorkflows(initialWorkflows);
  }, [maintenanceRequests]);

  const handleAction = (status: WorkflowState) => {
    if (!selectedRequest) return;
    updateMaintenanceStatus(selectedRequest, status);
  };

  const selectedWorkflow = selectedRequest ? 
    demoWorkflows.find(w => w.maintenance_request_id === selectedRequest) : null;
    
  const getStatusBadge = (state?: WorkflowState) => {
    if (!state) return null;
    const statusConfig: Record<string, { color: string; label: string }> = {
      SUBMITTED: { color: "bg-blue-500/20 text-blue-300", label: "New" },
      OWNER_NOTIFIED: { color: "bg-yellow-500/20 text-yellow-300", label: "Review" },
      COMPLETED: { color: "bg-green-500/20 text-green-300", label: "Resolved" },
    };
    const config = statusConfig[state] || { color: "bg-gray-500/20 text-gray-300", label: state };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Maintenance Command Center (Demo)</h1>
          <p className="text-muted-foreground">Autonomous triage, approval, and resolution</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">AI Efficiency</p>
            <p className="text-sm font-bold text-primary">84% Time Saved</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Requests</h2>
            <Badge variant="outline">{demoWorkflows.length}</Badge>
          </div>
          <div className="space-y-3">
            {demoWorkflows.map(wf => {
              const req = maintenanceRequests.find(r => r.id === wf.maintenance_request_id);
              return (
                <Card 
                  key={wf.id} 
                  className={cn(
                    "p-4 cursor-pointer transition-all border-l-4",
                    selectedRequest === wf.maintenance_request_id ? "border-primary bg-accent/50" : "border-transparent hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedRequest(wf.maintenance_request_id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-sm line-clamp-1">{req?.title}</p>
                    {getStatusBadge(wf.current_state)}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{wf.ai_analysis.urgency.toUpperCase()} • {wf.ai_analysis.category}</p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2 pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(req?.created_at || Date.now()), 'MMM d')}
                    </span>
                    <span className="flex items-center gap-1 text-primary">
                      AI View <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {selectedWorkflow ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <AIDecisionPanel analysis={selectedWorkflow.ai_analysis} isLoading={false} />
                </div>
                <div className="sm:w-1/3">
                  <Card className="p-4 bg-primary/5 border-primary/20 ai-glow h-full flex flex-col justify-center items-center text-center">
                    <AlertCircle className="h-8 w-8 text-primary mb-2" />
                    <h3 className="font-semibold text-sm">Owner Action Required</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">AI recommends approval for this high-urgency request.</p>
                    <div className="grid gap-2 w-full">
                      <Button onClick={() => handleAction('DECISION_MADE')} size="sm" className="w-full">Approve Dispatch</Button>
                      <Button variant="outline" size="sm" className="w-full">Deny</Button>
                      <Button variant="ghost" size="sm" className="w-full">Ask Question</Button>
                    </div>
                  </Card>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">Workflow Progression</h3>
                  <WorkflowTimeline 
                    currentState={selectedWorkflow.current_state} 
                    stateHistory={selectedWorkflow.state_history}
                  />
                </Card>
                <Card className="p-6">
                  <h3 className="text-sm font-semibold mb-4">Communication Feed</h3>
                  <CommunicationFeed 
                    communications={selectedWorkflow.communications} 
                    currentUserType="landlord" 
                  />
                </Card>
              </div>
              
              <Card className="p-4 border-dashed bg-muted/20">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium italic">"I've pre-selected QuickFix Plumbing for this task as they have a 4.8 rating and can respond within 2 hours."</h4>
                    <p className="text-xs text-primary mt-1 font-semibold">— PropAI Recommendation</p>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed h-full flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
                <Brain className="h-8 w-8 text-muted-foreground opacity-20" />
              </div>
              <h3 className="text-lg font-semibold text-muted-foreground">Select a Maintenance Workflow</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">Click on a request in the sidebar to review the AI analysis and orchestrate the resolution process.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
