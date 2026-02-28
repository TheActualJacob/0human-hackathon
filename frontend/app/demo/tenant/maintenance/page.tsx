'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Plus, Loader2, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDemoStore } from '@/lib/store/demo';
import { WorkflowTimeline } from '@/components/maintenance/WorkflowTimeline';
import { CommunicationFeed } from '@/components/maintenance/CommunicationFeed';
import { AIDecisionPanel } from '@/components/maintenance/AIDecisionPanel';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WorkflowState } from '@/types';

export default function DemoTenantMaintenancePage() {
  const { maintenanceRequests, addMaintenanceRequest } = useDemoStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  
  // Local state for demo workflows to simulate progression
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

  const handleSubmit = async () => {
    if (!description.trim()) return;

    setIsSubmitting(true);
    
    // Simulate AI processing time
    setTimeout(() => {
      const newReq = {
        title: description.split(' ').slice(0, 3).join(' ') + '...',
        description: description,
        category: 'other',
        priority: 'medium',
        tenant_id: 'tenant-1',
        unit_id: 'unit-1',
      };
      
      addMaintenanceRequest(newReq);
      setShowSubmitForm(false);
      setDescription('');
      setIsSubmitting(false);
      
      // The useEffect will pick up the new request and create a workflow for it
    }, 1500);
  };

  const selectedWorkflow = selectedRequest ? 
    demoWorkflows.find(w => w.maintenance_request_id === selectedRequest) : null;
    
  const getStatusBadge = (state?: WorkflowState) => {
    if (!state) return null;
    const statusConfig: Record<string, { color: string; label: string }> = {
      SUBMITTED: { color: 'bg-blue-500/20 text-blue-300', label: 'Submitted' },
      OWNER_NOTIFIED: { color: 'bg-yellow-500/20 text-yellow-300', label: 'Under Review' },
      COMPLETED: { color: 'bg-green-500/20 text-green-300', label: 'Completed' },
    };
    const config = statusConfig[state] || { color: 'bg-gray-500/20 text-gray-300', label: state };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance Requests (Demo)</h1>
          <p className="text-muted-foreground">
            Explore how our AI orchestrates repairs
          </p>
        </div>
        <div className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20 flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase">AI Active</span>
        </div>
      </div>

      <Card className="p-6 border-dashed border-2 bg-muted/20">
        <AnimatePresence mode="wait">
          {!showSubmitForm ? (
            <Button
              onClick={() => setShowSubmitForm(true)}
              className="w-full py-8 text-lg ai-glow"
            >
              <Plus className="h-5 w-5 mr-2" />
              Simulate New Request
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Label>What should the AI analyze?</Label>
              <Textarea
                placeholder="e.g., There's a leak under the kitchen sink that's soaking the cabinet..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={isSubmitting || !description.trim()} className="flex-1">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
                  {isSubmitting ? "AI Analyzing..." : "Submit to AI"}
                </Button>
                <Button variant="outline" onClick={() => setShowSubmitForm(false)}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your Requests</h2>
          <div className="space-y-3">
            {demoWorkflows.map(wf => {
              const req = maintenanceRequests.find(r => r.id === wf.maintenance_request_id);
              return (
                <Card 
                  key={wf.id} 
                  className={cn(
                    "p-4 cursor-pointer transition-all",
                    selectedRequest === wf.maintenance_request_id ? "border-primary ring-1 ring-primary/20" : "hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedRequest(wf.maintenance_request_id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-sm line-clamp-1">{req?.title}</p>
                    {getStatusBadge(wf.current_state)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{req?.description}</p>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-wider">
                    <span>{wf.ai_analysis.category}</span>
                    <span>{format(new Date(req?.created_at || Date.now()), 'MMM d, h:mm a')}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-semibold">AI Workflow Details</h2>
          {selectedWorkflow ? (
            <div className="space-y-6">
              <AIDecisionPanel analysis={selectedWorkflow.ai_analysis} isLoading={false} />
              <Card className="p-6">
                <WorkflowTimeline 
                  currentState={selectedWorkflow.current_state} 
                  stateHistory={selectedWorkflow.state_history}
                />
              </Card>
              <Card className="p-6">
                <CommunicationFeed 
                  communications={selectedWorkflow.communications} 
                  currentUserType="tenant" 
                />
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center border-dashed">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Brain className="h-6 w-6 text-muted-foreground opacity-20" />
              </div>
              <p className="text-muted-foreground text-sm">Select a request to see the AI orchestration in action</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
