'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Loader2, AlertTriangle, Filter, Search, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import useLandlordStore from '@/lib/store/landlord';
import useStore from '@/lib/store/useStore';
import { WorkflowTimeline } from '@/components/maintenance/WorkflowTimeline';
import { CommunicationFeed } from '@/components/maintenance/CommunicationFeed';
import { AIDecisionPanel } from '@/components/maintenance/AIDecisionPanel';
import { OwnerActionPanel } from '@/components/maintenance/OwnerActionPanel';
import { VendorCoordinationPanel } from '@/components/maintenance/VendorCoordinationPanel';
import { ResolutionPanel } from '@/components/maintenance/ResolutionPanel';
import { DebugPanel } from '@/components/maintenance/DebugPanel';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WorkflowState } from '@/types';

export default function LandlordMaintenancePage() {
  const {
    maintenanceRequests,
    units,
    tenants,
    loading,
    fetchLandlordData
  } = useLandlordStore();

  const {
    maintenanceWorkflows,
    workflowCommunications,
    vendorBids,
    selectedWorkflow,
    setSelectedWorkflow,
    handleOwnerResponse,
    handleVendorResponse,
    getWorkflowWithDetails
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLandlordData();
  }, []);

  // Get current workflow details
  const currentWorkflow = selectedWorkflow ? getWorkflowWithDetails(selectedWorkflow) : null;
  const workflowComms = currentWorkflow?.communications || [];
  const currentState = currentWorkflow?.current_state as WorkflowState | undefined;
  const aiAnalysis = currentWorkflow?.ai_analysis ? 
    (typeof currentWorkflow.ai_analysis === 'string' ? 
      JSON.parse(currentWorkflow.ai_analysis) : 
      currentWorkflow.ai_analysis) : 
    null;

  // Filter workflows
  const filteredWorkflows = maintenanceWorkflows.filter(workflow => {
    if (filterStatus !== 'all' && workflow.current_state !== filterStatus) {
      return false;
    }
    if (searchTerm) {
      // Search in description or unit identifier
      const request = maintenanceRequests.find(r => r.id === workflow.maintenance_request_id);
      const unit = units.find(u => u.id === request?.unit_id);
      
      return (
        request?.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit?.unit_identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return true;
  });

  const getStatusBadge = (state?: WorkflowState) => {
    if (!state) return null;

    const statusConfig: Record<WorkflowState, { color: string; label: string }> = {
      SUBMITTED: { color: 'bg-blue-500/20 text-blue-300', label: 'Submitted' },
      OWNER_NOTIFIED: { color: 'bg-yellow-500/20 text-yellow-300', label: 'Awaiting Response' },
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
          <p className="text-muted-foreground">Loading maintenance requests...</p>
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
              <h1 className="text-2xl font-bold">AI Maintenance Center</h1>
              <p className="text-sm text-muted-foreground">
                Review and manage maintenance requests with AI assistance
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by description or unit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'OWNER_NOTIFIED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('OWNER_NOTIFIED')}
          >
            Awaiting Response
          </Button>
          <Button
            variant={filterStatus === 'IN_PROGRESS' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('IN_PROGRESS')}
          >
            In Progress
          </Button>
          <Button
            variant={filterStatus === 'COMPLETED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('COMPLETED')}
          >
            Completed
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column - Request List */}
        <div className="w-[40%] border-r border-border overflow-y-auto p-6">
          <div className="space-y-4">
            {filteredWorkflows.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No maintenance requests found</p>
              </div>
            ) : (
              filteredWorkflows.map(workflow => {
                const request = maintenanceRequests.find(r => r.id === workflow.maintenance_request_id);
                const unit = units.find(u => u.id === request?.unit_id);
                const tenant = tenants.find(t => t.lease_id === request?.lease_id);
                const isSelected = selectedWorkflow === workflow.id;
                const analysis = workflow.ai_analysis ? 
                  (typeof workflow.ai_analysis === 'string' ? 
                    JSON.parse(workflow.ai_analysis) : 
                    workflow.ai_analysis) : 
                  null;

                return (
                  <Card
                    key={workflow.id}
                    className={cn(
                      "p-4 cursor-pointer transition-all",
                      isSelected ? "border-primary ai-glow" : "hover:border-primary/50"
                    )}
                    onClick={() => setSelectedWorkflow(workflow.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">
                            {unit?.unit_identifier || unit?.name || 'Unknown Unit'}
                          </span>
                          {analysis?.urgency && (
                            <span className={cn("text-xs font-medium", getUrgencyColor(analysis.urgency))}>
                              {analysis.urgency.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {tenant?.full_name || 'Unknown Tenant'}
                        </p>
                        <p className="text-sm line-clamp-2">
                          {request?.description || 'No description'}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(workflow.created_at), 'MMM d, h:mm a')}
                      </span>
                      {getStatusBadge(workflow.current_state as WorkflowState)}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="w-[60%] overflow-y-auto">
          {currentWorkflow ? (
            <div className="p-6 space-y-6">
              {/* Request Details */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Request Details</h3>
                {(() => {
                  const request = maintenanceRequests.find(r => r.id === currentWorkflow.maintenance_request_id);
                  const tenant = tenants.find(t => t.lease_id === request?.lease_id);
                  const photos: string[] = (request as any)?.photos || [];
                  return (
                    <div className="space-y-3">
                      {request?.title && (
                        <div>
                          <p className="text-sm text-muted-foreground">Title</p>
                          <p className="font-semibold">{request.title}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Tenant</p>
                        <p className="font-medium">{tenant?.full_name || 'Unknown Tenant'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Category</p>
                        <p className="font-medium capitalize">{request?.category || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Urgency</p>
                        <p className={cn("font-medium capitalize", getUrgencyColor(request?.urgency))}>
                          {request?.urgency || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Description</p>
                        <p className="mt-1">{request?.description}</p>
                      </div>
                      {photos.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Photos ({photos.length})</p>
                          <div className="grid grid-cols-2 gap-2">
                            {photos.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt={`Maintenance photo ${i + 1}`}
                                  className="w-full h-32 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity cursor-pointer"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </Card>

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

              {/* Communication Feed */}
              <Card className="p-6">
                <CommunicationFeed
                  communications={workflowComms}
                  currentUserType="owner"
                />
              </Card>

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
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Select a Request</p>
              <p className="text-sm text-muted-foreground">
                Choose a maintenance request from the list to view details
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