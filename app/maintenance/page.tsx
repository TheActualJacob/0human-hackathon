'use client';

import { useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import TicketCard from "@/components/maintenance/TicketCard";
import AIDecisionPanel from "@/components/maintenance/AIDecisionPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useStore from "@/lib/store/useStore";
import { classifyMaintenanceIssue, selectOptimalVendor, simulateProcessing } from "@/lib/agentEngine";
import type { MaintenanceTicketInsert } from "@/types";

export default function MaintenancePage() {
  const { 
    tickets, 
    vendors,
    tenants,
    selectedTicket, 
    setSelectedTicket,
    addTicket,
    updateTicket,
    addActivity,
    loading
  } = useStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tenantId: "",
    title: "",
    description: ""
  });

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.tenantName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || ticket.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const selectedTicketData = tickets.find(t => t.id === selectedTicket);
  const selectedVendor = selectedTicketData?.vendorId 
    ? vendors.find(v => v.id === selectedTicketData.vendorId)
    : undefined;

  const handleCreateTicket = async () => {
    if (!formData.tenantId || !formData.title || !formData.description) return;

    setIsProcessing(true);
    
    const tenant = tenants.find(t => t.id === formData.tenantId);
    if (!tenant) return;

    // Create the ticket
    const newTicketData: MaintenanceTicketInsert = {
      tenant_id: formData.tenantId,
      tenant_name: tenant.name,
      unit: tenant.unit,
      title: formData.title,
      description: formData.description,
      category: 'general',
      urgency: 'medium',
      status: 'open',
      ai_classified: false,
      ai_decisions: []
    };

    await addTicket(newTicketData);
    setIsCreateDialogOpen(false);

    // Get the newly created ticket
    const newTicket = tickets[0]; // Most recent ticket
    if (newTicket) {
      setSelectedTicket(newTicket.id);
      
      // Simulate AI processing
      await simulateProcessing(1500);

      // AI Classification
      const classification = classifyMaintenanceIssue(formData.description);
      await updateTicket(newTicket.id, {
        category: classification.category,
        urgency: classification.urgency,
        ai_classified: true,
        ai_decisions: [{
          timestamp: new Date(),
          action: "Issue Classification",
          reasoning: classification.reasoning,
          confidence: classification.confidence
        }]
      });

      await addActivity({
        type: 'maintenance',
        action: 'AI Classification',
        details: `Issue classified as ${classification.category} with ${classification.urgency} urgency`,
        entity_id: newTicket.id,
        ai_generated: true
      });

      await simulateProcessing(1000);

      // AI Vendor Assignment
      const vendorSelection = selectOptimalVendor(
        { 
          ...newTicket, 
          category: classification.category, 
          urgency: classification.urgency,
          aiDecisions: [],
          createdAt: new Date(newTicket.created_at),
          updatedAt: new Date(newTicket.updated_at)
        },
        vendors.map(v => ({
          ...v,
          avgResponseTime: v.avg_response_time,
          avgCost: v.avg_cost,
          aiPerformanceScore: v.ai_performance_score,
          isAvailable: v.is_available
        }))
      );

      if (vendorSelection) {
        const selectedVendorData = vendors.find(v => v.id === vendorSelection.vendorId);
        
        await updateTicket(newTicket.id, {
          vendor_id: vendorSelection.vendorId,
          vendor_name: selectedVendorData?.name,
          status: 'assigned',
          estimated_cost: selectedVendorData?.avg_cost,
          ai_decisions: [
            ...(newTicket.ai_decisions as any[] || []),
            {
              timestamp: new Date(),
              action: "Vendor Assignment",
              reasoning: vendorSelection.reasoning,
              confidence: vendorSelection.confidence
            }
          ]
        });

        await addActivity({
          type: 'vendor',
          action: 'Vendor Assigned',
          details: `${selectedVendorData?.name} assigned to ticket`,
          entity_id: newTicket.id,
          ai_generated: true
        });
      }
    }

    setIsProcessing(false);
    
    // Reset form
    setFormData({
      tenantId: "",
      title: "",
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
      {/* Left Panel - Ticket List */}
      <div className="w-[400px] border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Maintenance</h1>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm ai-glow"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </button>
          </div>

          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
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

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No maintenance tickets found
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicket === ticket.id}
                onClick={() => setSelectedTicket(ticket.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedTicketData ? (
          <div className="p-6">
            {/* Ticket Details Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{selectedTicketData.title}</h2>
              <p className="text-muted-foreground">{selectedTicketData.description}</p>
            </div>

            {/* AI Decision Panel */}
            <AIDecisionPanel 
              ticket={selectedTicketData} 
              vendor={selectedVendor}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a ticket to view details
          </div>
        )}
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Maintenance Ticket</DialogTitle>
            <DialogDescription>
              Submit a new maintenance request. Our AI will classify and assign it automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Select
                value={formData.tenantId}
                onValueChange={(value) => setFormData({ ...formData, tenantId: value })}
              >
                <SelectTrigger id="tenant">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} - Unit {tenant.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Issue Title</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Provide details about the maintenance issue..."
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
              onClick={handleCreateTicket}
              disabled={isProcessing || !formData.tenantId || !formData.title || !formData.description}
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