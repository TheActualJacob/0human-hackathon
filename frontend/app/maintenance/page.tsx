'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Plus, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import useStore from '@/lib/store/useStore';
import { WorkflowTimeline } from '@/components/maintenance/WorkflowTimeline';
import { CommunicationFeed } from '@/components/maintenance/CommunicationFeed';
import { AIDecisionPanel } from '@/components/maintenance/AIDecisionPanel';
import { OwnerActionPanel } from '@/components/maintenance/OwnerActionPanel';
import { VendorCoordinationPanel } from '@/components/maintenance/VendorCoordinationPanel';
import { ResolutionPanel } from '@/components/maintenance/ResolutionPanel';
import { DebugPanel } from '@/components/maintenance/DebugPanel';
import type { WorkflowState } from '@/types';

export default function MaintenancePage() {
  const {
    leases,
    tenants,
    units,
    maintenanceWorkflows,
    workflowCommunications,
    vendorBids,
    selectedWorkflow,
    setSelectedWorkflow,
    submitMaintenanceWorkflow,
    handleOwnerResponse,
    handleVendorResponse,
    getWorkflowWithDetails,
    loading,
    error
  } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [formData, setFormData] = useState({
    leaseId: '',
    description: ''
  });

  // Get current workflow details
  const currentWorkflow = selectedWorkflow ? getWorkflowWithDetails(selectedWorkflow) : null;
  const workflowComms = currentWorkflow?.communications || [];
  const currentState = currentWorkflow?.current_state as WorkflowState | undefined;
  // ai_analysis might already be an object from Supabase
  const aiAnalysis = currentWorkflow?.ai_analysis ? 
    (typeof currentWorkflow.ai_analysis === 'string' ? 
      JSON.parse(currentWorkflow.ai_analysis) : 
      currentWorkflow.ai_analysis) : 
    null;

  // Filter active leases with tenants for the dropdown
  const activeLeasesWithTenants = leases
    .filter(l => l.status === 'active')
    .map(lease => ({
      lease,
      tenant: tenants.find(t => t.lease_id === lease.id && t.is_primary_tenant),
      unit: units.find(u => u.id === lease.unit_id)
    }))
    .filter(l => l.tenant && l.unit);

  // Auto-select first workflow if none selected
  useEffect(() => {
    if (!selectedWorkflow && maintenanceWorkflows.length > 0) {
      setSelectedWorkflow(maintenanceWorkflows[0].id);
    }
  }, [maintenanceWorkflows, selectedWorkflow, setSelectedWorkflow]);
  
  // Clear any database connection errors on mount
  useEffect(() => {
    if (error?.includes('nodename nor servname provided')) {
      // This error is expected, clear it
      useStore.setState({ error: null });
    }
  }, [error]);

  const handleSubmit = async () => {
    if (!formData.leaseId || !formData.description.trim()) return;

    setIsSubmitting(true);
    try {
      await submitMaintenanceWorkflow(formData.leaseId, formData.description);
      setShowSubmitForm(false);
      setFormData({ leaseId: '', description: '' });
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
      OWNER_NOTIFIED: { color: 'bg-yellow-500/20 text-yellow-300', label: 'Awaiting Owner' },
      OWNER_RESPONDED: { color: 'bg-purple-500/20 text-purple-300', label: 'Owner Responded' },
      DECISION_MADE: { color: 'bg-green-500/20 text-green-300', label: 'Approved' },
      VENDOR_CONTACTED: { color: 'bg-orange-500/20 text-orange-300', label: 'Finding Vendor' },
      AWAITING_VENDOR_RESPONSE: { color: 'bg-orange-500/20 text-orange-300', label: 'Awaiting Vendor' },
      ETA_CONFIRMED: { color: 'bg-indigo-500/20 text-indigo-300', label: 'Scheduled' },
      TENANT_NOTIFIED: { color: 'bg-blue-500/20 text-blue-300', label: 'Tenant Notified' },
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
          <p className="text-muted-foreground">Loading AI Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
              className="rounded-lg bg-primary/10 p-3"
            >
              <Brain className="h-8 w-8 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold">AI Maintenance Command Center</h1>
              <p className="text-sm text-muted-foreground">
                Autonomous triage, approval, dispatch, and resolution
              </p>
            </div>
          </div>
          
          {currentState && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Current Status</p>
              {getStatusBadge(currentState)}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - 65% */}
        <div className="w-[65%] border-r border-border overflow-y-auto p-6 space-y-6">
          {/* Submission Card */}
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
                  <h3 className="text-lg font-semibold">Submit Maintenance Request</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lease">Unit / Tenant</Label>
                    <Select
                      value={formData.leaseId}
                      onValueChange={(value) => setFormData({ ...formData, leaseId: value })}
                    >
                      <SelectTrigger id="lease">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeLeasesWithTenants.map(({ lease, tenant, unit }) => (
                          <SelectItem key={lease.id} value={lease.id}>
                            {unit.unit_identifier} - {tenant.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the maintenance issue..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !formData.leaseId || !formData.description}
                      className="flex-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          AI analyzing and notifying owner...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Submit to AI
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowSubmitForm(false);
                        setFormData({ leaseId: '', description: '' });
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

          {currentWorkflow && (
            <>
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

              {/* Communication Feed */}
              <Card className="p-6">
                <CommunicationFeed
                  communications={workflowComms}
                  currentUserType="owner"
                />
              </Card>
            </>
          )}
        </div>

        {/* Right Column - 35% */}
        <div className="w-[35%] overflow-y-auto p-6 space-y-6">
          {currentWorkflow ? (
            <>
              {/* AI Decision Panel */}
              <AIDecisionPanel
                analysis={aiAnalysis}
                isLoading={false}
              />

              {/* Owner Action Panel */}
              <OwnerActionPanel
                workflowId={currentWorkflow.id}
                onResponse={handleOwnerResponse}
                isVisible={currentState === 'OWNER_NOTIFIED'}
                isLoading={isSubmitting}
              />

              {/* Vendor Coordination Panel */}
              <VendorCoordinationPanel
                workflowId={currentWorkflow.id}
                vendorMessage={currentWorkflow.vendor_message}
                vendorBids={currentWorkflow.vendor_bids || []}
                onVendorResponse={handleVendorResponse}
                isVisible={
                  currentState === 'VENDOR_CONTACTED' || 
                  currentState === 'AWAITING_VENDOR_RESPONSE'
                }
                isLoading={isSubmitting}
              />

              {/* Resolution Panel */}
              <ResolutionPanel
                workflowId={currentWorkflow.id}
                isCompleted={currentState === 'COMPLETED'}
                startTime={currentWorkflow.created_at}
                completionTime={currentWorkflow.updated_at}
                estimatedCost={
                  aiAnalysis?.estimated_cost_range === 'low' ? 150 :
                  aiAnalysis?.estimated_cost_range === 'medium' ? 500 :
                  1000
                }
                actualCost={450} // Mock for demo
                vendorEta={currentWorkflow.vendor_eta || undefined}
                wasEtaHonored={true}
              />

              {/* Workflow List */}
              {maintenanceWorkflows.length > 1 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Other Workflows</h3>
                  <div className="space-y-2">
                    {maintenanceWorkflows
                      .filter(w => w.id !== selectedWorkflow)
                      .slice(0, 5)
                      .map(workflow => {
                        const request = currentWorkflow.maintenance_request;
                        return (
                          <button
                            key={workflow.id}
                            onClick={() => setSelectedWorkflow(workflow.id)}
                            className="w-full text-left p-2 rounded-lg hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm truncate">
                                Request #{workflow.id.slice(0, 8)}
                              </span>
                              {getStatusBadge(workflow.current_state as WorkflowState)}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No Active Workflows</p>
              <p className="text-sm text-muted-foreground">
                Submit a maintenance request to get started
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
}