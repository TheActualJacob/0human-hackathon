'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Plus, Loader2, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import useTenantStore from '@/lib/store/tenant';
import useStore from '@/lib/store/useStore';
import { WorkflowTimeline } from '@/components/maintenance/WorkflowTimeline';
import { CommunicationFeed } from '@/components/maintenance/CommunicationFeed';
import { AIDecisionPanel } from '@/components/maintenance/AIDecisionPanel';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WorkflowState } from '@/types';

export default function TenantMaintenancePage() {
  const {
    tenantInfo,
    maintenanceRequests,
    loading,
    fetchTenantData,
    submitMaintenanceRequest
  } = useTenantStore();

  const {
    maintenanceWorkflows,
    workflowCommunications,
    submitMaintenanceWorkflow,
    getWorkflowWithDetails
  } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  useEffect(() => {
    if (tenantInfo?.id) {
      fetchTenantData(tenantInfo.id);
    }
  }, [tenantInfo?.id]);

  // Get workflows for this tenant's requests
  const tenantWorkflows = maintenanceWorkflows.filter(workflow => {
    const request = maintenanceRequests.find(r => r.id === workflow.maintenance_request_id);
    return request?.lease_id === tenantInfo?.lease_id;
  });

  // Get selected workflow details
  const selectedWorkflow = selectedRequest ? 
    tenantWorkflows.find(w => w.maintenance_request_id === selectedRequest) : null;
  const currentWorkflow = selectedWorkflow ? getWorkflowWithDetails(selectedWorkflow.id) : null;
  const workflowComms = currentWorkflow?.communications || [];
  const currentState = currentWorkflow?.current_state as WorkflowState | undefined;
  const aiAnalysis = currentWorkflow?.ai_analysis ? 
    (typeof currentWorkflow.ai_analysis === 'string' ? 
      JSON.parse(currentWorkflow.ai_analysis) : 
      currentWorkflow.ai_analysis) : 
    null;

  const handleSubmit = async () => {
    if (!description.trim() || !tenantInfo?.lease_id) return;

    setIsSubmitting(true);
    try {
      await submitMaintenanceWorkflow(tenantInfo.lease_id, description);
      setShowSubmitForm(false);
      setDescription('');
      // Refresh data
      fetchTenantData(tenantInfo.id);
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (state?: WorkflowState) => {
    if (!state) return null;

    const statusConfig: Record<WorkflowState, { color: string; label: string }> = {
      SUBMITTED: { color: 'bg-blue-500/20 text-blue-300', label: 'Submitted' },
      OWNER_NOTIFIED: { color: 'bg-yellow-500/20 text-yellow-300', label: 'Under Review' },
      OWNER_RESPONDED: { color: 'bg-purple-500/20 text-purple-300', label: 'Owner Responded' },
      DECISION_MADE: { color: 'bg-green-500/20 text-green-300', label: 'Approved' },
      VENDOR_CONTACTED: { color: 'bg-orange-500/20 text-orange-300', label: 'Finding Vendor' },
      AWAITING_VENDOR_RESPONSE: { color: 'bg-orange-500/20 text-orange-300', label: 'Vendor Contacted' },
      ETA_CONFIRMED: { color: 'bg-indigo-500/20 text-indigo-300', label: 'Scheduled' },
      TENANT_NOTIFIED: { color: 'bg-blue-500/20 text-blue-300', label: 'Notified' },
      IN_PROGRESS: { color: 'bg-green-500/20 text-green-300', label: 'In Progress' },
      COMPLETED: { color: 'bg-green-500/20 text-green-300', label: 'Completed' },
      CLOSED_DENIED: { color: 'bg-red-500/20 text-red-300', label: 'Denied' }
    };

    const config = statusConfig[state] || { color: 'bg-gray-500/20 text-gray-300', label: state };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'emergency': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading maintenance requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Maintenance Requests</h1>
          <p className="text-muted-foreground">
            Submit and track maintenance requests with AI-powered assistance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
            className="rounded-lg bg-primary/10 p-2"
          >
            <Brain className="h-6 w-6 text-primary" />
          </motion.div>
          <span className="text-sm text-muted-foreground">AI-Powered</span>
        </div>
      </div>

      {/* Submit New Request */}
      <Card className="p-6">
        <AnimatePresence mode="wait">
          {!showSubmitForm ? (
            <motion.div
              key="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Button
                onClick={() => setShowSubmitForm(true)}
                className="w-full py-6 text-lg ai-glow"
              >
                <Plus className="h-5 w-5 mr-2" />
                Submit New Maintenance Request
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold">New Maintenance Request</h3>
              
              <div className="space-y-2">
                <Label htmlFor="description">What needs to be fixed?</Label>
                <Textarea
                  id="description"
                  placeholder="Please describe the issue in detail..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Our AI will analyze your request and determine the urgency and required action
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !description.trim()}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting to AI...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Submit Request
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowSubmitForm(false);
                    setDescription('');
                  }}
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Existing Requests */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Maintenance Requests</h2>
        
        {maintenanceRequests.length === 0 ? (
          <Card className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No maintenance requests</p>
            <p className="text-sm text-muted-foreground">
              Submit a request above if you need something fixed
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {maintenanceRequests.map(request => {
              const workflow = tenantWorkflows.find(w => w.maintenance_request_id === request.id);
              const analysis = workflow?.ai_analysis ? 
                (typeof workflow.ai_analysis === 'string' ? 
                  JSON.parse(workflow.ai_analysis) : 
                  workflow.ai_analysis) : 
                null;
              const isSelected = selectedRequest === request.id;

              return (
                <Card
                  key={request.id}
                  className={cn(
                    "p-4 cursor-pointer transition-all",
                    isSelected ? "border-primary ai-glow" : "hover:border-primary/50"
                  )}
                  onClick={() => setSelectedRequest(request.id)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm line-clamp-2">
                          {request.description}
                        </p>
                      </div>
                      {analysis?.urgency && (
                        <span className={cn("text-xs font-medium ml-2", getUrgencyColor(analysis.urgency))}>
                          {analysis.urgency.toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{format(new Date(request.created_at), 'MMM d, h:mm a')}</span>
                      </div>
                      {workflow && getStatusBadge(workflow.current_state as WorkflowState)}
                    </div>

                    {analysis && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">AI Analysis</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {analysis.category?.replace(/_/g, ' ')}
                          </Badge>
                          {analysis.vendor_required !== undefined && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs",
                                analysis.vendor_required ? "text-orange-400" : "text-green-400"
                              )}
                            >
                              {analysis.vendor_required ? "Vendor Required" : "DIY Possible"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Request Details */}
      {currentWorkflow && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* AI Decision Panel */}
            <AIDecisionPanel
              analysis={aiAnalysis}
              isLoading={false}
            />

            {/* Workflow Timeline */}
            <Card className="p-6">
              <WorkflowTimeline
                currentState={currentState!}
                stateHistory={
                  typeof currentWorkflow.state_history === 'string' ? 
                    JSON.parse(currentWorkflow.state_history || '[]') : 
                    (currentWorkflow.state_history || [])
                }
                isDenied={currentState === 'CLOSED_DENIED'}
              />
            </Card>
          </div>

          {/* Communication Feed */}
          <Card className="p-6">
            <CommunicationFeed
              communications={workflowComms}
              currentUserType="tenant"
            />
          </Card>

          {/* Status Messages */}
          {currentState === 'ETA_CONFIRMED' && currentWorkflow.vendor_eta && (
            <Card className="p-4 border-indigo-500/20 bg-indigo-500/5">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="font-medium">Repair Scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    A vendor will arrive on {format(new Date(currentWorkflow.vendor_eta), 'EEEE, MMMM d at h:mm a')}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {currentState === 'COMPLETED' && (
            <Card className="p-4 border-green-500/20 bg-green-500/5">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div>
                  <p className="font-medium">Request Completed</p>
                  <p className="text-sm text-muted-foreground">
                    This maintenance request has been resolved
                  </p>
                </div>
              </div>
            </Card>
          )}

          {currentState === 'CLOSED_DENIED' && (
            <Card className="p-4 border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <div>
                  <p className="font-medium">Request Denied</p>
                  <p className="text-sm text-muted-foreground">
                    Your maintenance request was not approved. Please contact your landlord for more information.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}