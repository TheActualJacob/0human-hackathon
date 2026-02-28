'use client';

import { useState } from "react";
import { 
  Plus, Search, Filter, Home, User, Calendar, 
  AlertCircle, Wrench, Clock, DollarSign 
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useStore from "@/lib/store/useStore";
import { classifyMaintenanceIssue, selectOptimalVendor, simulateProcessing } from "@/lib/agentEngine";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { MaintenanceRequestInsert, MaintenanceRequestWithDetails } from "@/types";

export default function MaintenancePage() {
  const { 
    maintenanceRequests,
    maintenanceIssues,
    contractors,
    leases,
    tenants,
    units,
    getMaintenanceRequestWithDetails,
    selectedMaintenanceRequest,
    setSelectedMaintenanceRequest,
    addMaintenanceRequest,
    updateMaintenanceRequest,
    logAgentAction,
    loading
  } = useStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    leaseId: "",
    description: ""
  });

  // Filter active leases with tenants
  const activeLeasesWithTenants = leases
    .filter(l => l.status === 'active')
    .map(lease => ({
      lease,
      tenant: tenants.find(t => t.lease_id === lease.id && t.is_primary_tenant),
      unit: units.find(u => u.id === lease.unit_id)
    }))
    .filter(l => l.tenant && l.unit);

  // Filter requests
  const filteredRequests = maintenanceRequests.filter(request => {
    const details = getMaintenanceRequestWithDetails(request.id);
    const matchesSearch = request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         details?.lease?.tenants?.[0]?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         details?.lease?.unit?.unit_identifier.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || request.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const selectedRequestData = selectedMaintenanceRequest 
    ? getMaintenanceRequestWithDetails(selectedMaintenanceRequest)
    : null;

  // Get urgency color
  const getUrgencyColor = (urgency: string | null) => {
    switch (urgency) {
      case 'emergency': return 'bg-red-500/20 text-red-300';
      case 'high': return 'bg-orange-500/20 text-orange-300';
      case 'routine': return 'bg-blue-500/20 text-blue-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'open': return 'bg-yellow-500/20 text-yellow-300';
      case 'assigned': return 'bg-blue-500/20 text-blue-300';
      case 'in_progress': return 'bg-purple-500/20 text-purple-300';
      case 'completed': return 'bg-green-500/20 text-green-300';
      case 'closed': return 'bg-gray-500/20 text-gray-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const handleCreateRequest = async () => {
    if (!formData.leaseId || !formData.description) return;

    setIsProcessing(true);
    
    // Create the request
    const newRequestData: MaintenanceRequestInsert = {
      lease_id: formData.leaseId,
      description: formData.description,
      category: 'other',
      urgency: 'routine',
      status: 'open'
    };

    await addMaintenanceRequest(newRequestData);
    setIsCreateDialogOpen(false);

    // Get the newly created request
    const newRequest = maintenanceRequests[0]; // Most recent request
    if (newRequest) {
      setSelectedMaintenanceRequest(newRequest.id);
      
      // Simulate AI processing
      await simulateProcessing(1500);

      // AI Classification
      const classification = classifyMaintenanceIssue(formData.description);
      
      // Check if this could be a chronic issue
      const relatedIssue = maintenanceIssues.find(issue => 
        issue.issue_type === classification.category.toLowerCase() &&
        issue.status !== 'resolved'
      );

      await updateMaintenanceRequest(newRequest.id, {
        category: classification.category as any,
        urgency: classification.urgency as any,
        maintenance_issue_id: relatedIssue?.id || null
      });

      await logAgentAction({
        lease_id: formData.leaseId,
        action_category: 'maintenance',
        action_description: `Classified maintenance request as ${classification.category} with ${classification.urgency} urgency`,
        confidence_score: classification.confidence
      });

      await simulateProcessing(1000);

      // AI Contractor Assignment
      const vendorSelection = selectOptimalVendor(
        { 
          id: newRequest.id,
          title: formData.description.slice(0, 50),
          description: formData.description,
          category: classification.category,
          urgency: classification.urgency,
          status: 'open',
          vendorId: null,
          vendorName: null,
          tenantId: '',
          tenantName: '',
          unit: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          aiClassified: true,
          aiDecisions: [],
          estimatedCost: null
        },
        contractors.map(c => ({
          id: c.id,
          name: c.name,
          specialty: c.trades || [],
          avgResponseTime: 24,
          avgCost: 150,
          rating: 4.5,
          isAvailable: c.emergency_available || true,
          aiPerformanceScore: 0.85
        }))
      );

      if (vendorSelection) {
        const selectedContractor = contractors.find(c => c.id === vendorSelection.vendorId);
        
        await updateMaintenanceRequest(newRequest.id, {
          contractor_id: vendorSelection.vendorId,
          status: 'assigned',
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
        });

        await logAgentAction({
          lease_id: formData.leaseId,
          action_category: 'maintenance',
          action_description: `Assigned contractor ${selectedContractor?.name} to maintenance request`,
          confidence_score: vendorSelection.confidence
        });
      }
    }

    setIsProcessing(false);
    
    // Reset form
    setFormData({
      leaseId: "",
      description: ""
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading maintenance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Request List */}
      <div className="w-[450px] border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Maintenance Requests</h1>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm ai-glow"
            >
              <Plus className="h-4 w-4" />
              New Request
            </button>
          </div>

          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Request List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No maintenance requests found
            </div>
          ) : (
            filteredRequests.map(request => {
              const details = getMaintenanceRequestWithDetails(request.id);
              const isSelected = selectedMaintenanceRequest === request.id;
              
              return (
                <div
                  key={request.id}
                  onClick={() => setSelectedMaintenanceRequest(request.id)}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all",
                    isSelected
                      ? "bg-accent border-primary ai-glow"
                      : "bg-card border-border hover:border-primary/50"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium line-clamp-1">
                        {request.description.slice(0, 50)}...
                      </h3>
                      {request.maintenance_issue_id && (
                        <AlertCircle className="h-4 w-4 text-orange-400 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs">
                      <span className={cn(
                        "px-2 py-1 rounded",
                        getUrgencyColor(request.urgency)
                      )}>
                        {request.urgency}
                      </span>
                      <span className={cn(
                        "px-2 py-1 rounded",
                        getStatusColor(request.status)
                      )}>
                        {request.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {details?.lease?.tenants?.[0] && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {details.lease.tenants[0].full_name}
                        </span>
                      )}
                      {details?.lease?.unit && (
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" />
                          {details.lease.unit.unit_identifier}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(request.created_at || ''), 'MMM d')}
                      </span>
                      {request.contractor_id && (
                        <span className="flex items-center gap-1 text-primary">
                          <Wrench className="h-3 w-3" />
                          Assigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedRequestData ? (
          <div className="p-6 space-y-6">
            {/* Request Header */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold">Maintenance Request</h2>
                <span className={cn(
                  "px-3 py-1 rounded text-sm font-medium",
                  getStatusColor(selectedRequestData.status)
                )}>
                  {selectedRequestData.status?.replace(/_/g, ' ')}
                </span>
              </div>
              
              <div className="space-y-4">
                <div className="bg-accent/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Description</p>
                  <p>{selectedRequestData.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Category</p>
                    <p className="font-medium capitalize">{selectedRequestData.category}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Urgency</p>
                    <span className={cn(
                      "inline-flex px-2 py-1 rounded text-sm font-medium",
                      getUrgencyColor(selectedRequestData.urgency)
                    )}>
                      {selectedRequestData.urgency}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tenant & Unit Info */}
            {selectedRequestData.lease && (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Location & Tenant</h3>
                <div className="space-y-2">
                  {selectedRequestData.lease.unit && (
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {selectedRequestData.lease.unit.unit_identifier}, {selectedRequestData.lease.unit.address}
                      </span>
                    </div>
                  )}
                  {selectedRequestData.lease.tenants?.[0] && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {selectedRequestData.lease.tenants[0].full_name} - {selectedRequestData.lease.tenants[0].whatsapp_number}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contractor Info */}
            {selectedRequestData.contractor ? (
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Assigned Contractor</h3>
                <div className="space-y-2">
                  <p className="font-medium">{selectedRequestData.contractor.name}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {selectedRequestData.contractor.phone && (
                      <span>{selectedRequestData.contractor.phone}</span>
                    )}
                    {selectedRequestData.contractor.email && (
                      <span>{selectedRequestData.contractor.email}</span>
                    )}
                  </div>
                  {selectedRequestData.scheduled_at && (
                    <div className="flex items-center gap-2 mt-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Scheduled: {format(new Date(selectedRequestData.scheduled_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-accent/50 border border-primary/30 rounded-lg p-4">
                <p className="text-sm text-center text-muted-foreground">
                  No contractor assigned yet
                </p>
              </div>
            )}

            {/* Chronic Issue Warning */}
            {selectedRequestData.chronic_issue && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-400 mb-1">
                      Linked to Chronic Issue
                    </h3>
                    <p className="text-sm mb-2">{selectedRequestData.chronic_issue.title}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Type: {selectedRequestData.chronic_issue.issue_type}</span>
                      <span>Reports: {selectedRequestData.chronic_issue.report_count}</span>
                      <span>Status: {selectedRequestData.chronic_issue.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cost Estimate */}
            {selectedRequestData.cost && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Estimated Cost</h3>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    <span className="text-xl font-bold">${selectedRequestData.cost}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {selectedRequestData.status === 'assigned' && (
                <Button 
                  onClick={() => updateMaintenanceRequest(selectedRequestData.id, { status: 'in_progress' })}
                  className="flex-1"
                >
                  Mark In Progress
                </Button>
              )}
              {selectedRequestData.status === 'in_progress' && (
                <Button 
                  onClick={() => updateMaintenanceRequest(selectedRequestData.id, { 
                    status: 'completed',
                    completed_at: new Date().toISOString()
                  })}
                  className="flex-1"
                >
                  Mark Completed
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a maintenance request to view details
          </div>
        )}
      </div>

      {/* Create Request Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Maintenance Request</DialogTitle>
            <DialogDescription>
              Submit a new maintenance request. Our AI will classify and assign it automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
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
              {/* Pre-filled example for demo */}
              {formData.description === "" && (
                <button
                  type="button"
                  onClick={() => setFormData({ 
                    ...formData, 
                    description: "There's water leaking under my sink. It started yesterday and is getting worse." 
                  })}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  Try example: "There's water leaking under my sink..."
                </button>
              )}
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateRequest}
              disabled={isProcessing || !formData.leaseId || !formData.description}
              className="ai-glow"
            >
              {isProcessing ? "Running AI Agent..." : "Run AI Agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}