'use client';

import { useState } from 'react';
import { 
  Scale, Plus, AlertTriangle, FileText, Clock, 
  CheckCircle, XCircle, Calendar, ChevronRight,
  Home, User, MessageSquare, Filter, Gavel
} from 'lucide-react';
import useStore from '@/lib/store/useStore';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Dispute, LegalAction, DisputeWithDetails } from '@/types';

export default function LegalPage() {
  const { 
    disputes,
    legalActions,
    leases,
    tenants,
    units,
    getLeaseWithTenants,
    addDispute,
    updateDispute,
    addLegalAction,
    loading 
  } = useStore();

  const [selectedDispute, setSelectedDispute] = useState<string | null>(null);
  const [showAddDisputeModal, setShowAddDisputeModal] = useState(false);
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'disputes' | 'actions'>('disputes');

  // Get dispute with details
  const getDisputeWithDetails = (disputeId: string): DisputeWithDetails | null => {
    const dispute = disputes.find(d => d.id === disputeId);
    if (!dispute) return null;

    const lease = getLeaseWithTenants(dispute.lease_id);
    const disputeLegalActions = legalActions.filter(la => la.dispute_id === disputeId);

    return {
      ...dispute,
      lease,
      legal_actions: disputeLegalActions
    };
  };

  // Get status color
  const getDisputeStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-500/20 text-yellow-300';
      case 'under_review': return 'bg-blue-500/20 text-blue-300';
      case 'ruled': return 'bg-green-500/20 text-green-300';
      case 'appealed': return 'bg-orange-500/20 text-orange-300';
      case 'closed': return 'bg-gray-500/20 text-gray-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getActionStatusColor = (status: string) => {
    switch (status) {
      case 'issued': return 'bg-blue-500/20 text-blue-300';
      case 'acknowledged': return 'bg-yellow-500/20 text-yellow-300';
      case 'complied': return 'bg-green-500/20 text-green-300';
      case 'escalated': return 'bg-red-500/20 text-red-300';
      case 'expired': return 'bg-gray-500/20 text-gray-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case 'eviction_notice':
      case 'section_8':
      case 'section_21':
        return AlertTriangle;
      case 'payment_demand':
      case 'payment_plan_agreement':
        return FileText;
      default:
        return Gavel;
    }
  };

  // Selected dispute details
  const selectedDisputeDetails = selectedDispute 
    ? getDisputeWithDetails(selectedDispute)
    : null;

  // Filter active disputes
  const activeDisputes = disputes.filter(d => 
    d.status !== 'closed' && d.status !== 'ruled'
  );

  // Recent legal actions
  const recentActions = legalActions.slice(0, 10);

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading legal information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Legal Management</h1>
            <p className="text-muted-foreground">
              Track disputes, legal notices, and compliance actions
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddActionModal(true)}
              className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors"
            >
              <FileText className="h-5 w-5" />
              Issue Notice
            </button>
            <button
              onClick={() => setShowAddDisputeModal(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-5 w-5" />
              New Dispute
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Scale className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-semibold">{activeDisputes.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">Active Disputes</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span className="text-2xl font-semibold">
                {legalActions.filter(la => la.status === 'issued').length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Pending Actions</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span className="text-2xl font-semibold">
                {disputes.filter(d => d.status === 'ruled').length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Resolved</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-orange-400" />
              <span className="text-2xl font-semibold">
                {legalActions.filter(la => 
                  la.response_deadline && 
                  new Date(la.response_deadline) > new Date() &&
                  !la.response_received_at
                ).length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Awaiting Response</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-6 border-b border-border">
          <button
            onClick={() => setActiveTab('disputes')}
            className={cn(
              "pb-4 text-sm font-medium transition-colors relative",
              activeTab === 'disputes'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Disputes
            {activeTab === 'disputes' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={cn(
              "pb-4 text-sm font-medium transition-colors relative",
              activeTab === 'actions'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Legal Actions
            {activeTab === 'actions' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {activeTab === 'disputes' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Active Disputes</h2>
                <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                  <Filter className="h-4 w-4" />
                </button>
              </div>

              {activeDisputes.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                  <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No active disputes</p>
                  <button
                    onClick={() => setShowAddDisputeModal(true)}
                    className="text-primary hover:underline"
                  >
                    Record a new dispute
                  </button>
                </div>
              ) : (
                activeDisputes.map(dispute => {
                  const details = getDisputeWithDetails(dispute.id);
                  if (!details?.lease) return null;

                  return (
                    <div
                      key={dispute.id}
                      onClick={() => setSelectedDispute(dispute.id)}
                      className={cn(
                        "bg-card border rounded-lg p-6 cursor-pointer transition-all",
                        selectedDispute === dispute.id
                          ? "border-primary ai-glow"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold">
                              {dispute.category.replace(/_/g, ' ')}
                            </h3>
                            <span className={cn(
                              "text-xs font-medium px-2 py-1 rounded",
                              getDisputeStatusColor(dispute.status || '')
                            )}>
                              {dispute.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {details.lease.tenants?.[0]?.full_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Home className="h-3 w-3" />
                              {details.lease.unit?.unit_identifier}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(dispute.opened_at || ''), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {dispute.description}
                      </p>

                      {details.legal_actions && details.legal_actions.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Gavel className="h-4 w-4 text-primary" />
                          <span className="text-sm text-primary">
                            {details.legal_actions.length} legal {details.legal_actions.length === 1 ? 'action' : 'actions'} taken
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Recent Legal Actions</h2>
                <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                  <Filter className="h-4 w-4" />
                </button>
              </div>

              {recentActions.length === 0 ? (
                <div className="bg-card border border-border rounded-lg p-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No legal actions taken</p>
                </div>
              ) : (
                recentActions.map(action => {
                  const lease = leases.find(l => l.id === action.lease_id);
                  const tenant = lease ? tenants.find(t => t.lease_id === lease.id) : null;
                  const unit = lease ? units.find(u => u.id === lease.unit_id) : null;
                  const Icon = getActionTypeIcon(action.action_type);

                  return (
                    <div
                      key={action.id}
                      className="bg-card border border-border rounded-lg p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          action.status === 'escalated' ? "bg-red-500/20" : "bg-primary/20"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            action.status === 'escalated' ? "text-red-400" : "text-primary"
                          )} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">
                              {action.action_type.replace(/_/g, ' ')}
                            </h3>
                            <span className={cn(
                              "text-xs font-medium px-2 py-1 rounded",
                              getActionStatusColor(action.status || '')
                            )}>
                              {action.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                            {tenant && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {tenant.full_name}
                              </span>
                            )}
                            {unit && (
                              <span className="flex items-center gap-1">
                                <Home className="h-3 w-3" />
                                {unit.unit_identifier}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(action.issued_at || ''), 'MMM d, yyyy')}
                            </span>
                          </div>

                          {action.response_deadline && (
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-orange-400" />
                              <span className={cn(
                                action.response_received_at
                                  ? "text-muted-foreground"
                                  : new Date(action.response_deadline) < new Date()
                                    ? "text-red-400"
                                    : "text-orange-400"
                              )}>
                                Response {action.response_received_at ? 'received' : 'due'}: {
                                  format(new Date(action.response_deadline), 'MMM d, yyyy')
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {selectedDisputeDetails ? (
            <>
              {/* Dispute Details */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Dispute Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="font-medium">{selectedDisputeDetails.category.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{selectedDisputeDetails.status?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Opened</p>
                    <p className="font-medium">
                      {format(new Date(selectedDisputeDetails.opened_at || ''), 'MMM d, yyyy')}
                    </p>
                  </div>
                  {selectedDisputeDetails.ruling && (
                    <div>
                      <p className="text-xs text-muted-foreground">Ruling</p>
                      <p className="text-sm">{selectedDisputeDetails.ruling}</p>
                    </div>
                  )}
                </div>

                {selectedDisputeDetails.status === 'open' && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <button className="w-full text-sm bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors">
                      Update Status
                    </button>
                    <button className="w-full text-sm border border-border px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                      Add Evidence
                    </button>
                  </div>
                )}
              </div>

              {/* Legal Actions Timeline */}
              {selectedDisputeDetails.legal_actions && selectedDisputeDetails.legal_actions.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Legal Actions</h3>
                  <div className="space-y-3">
                    {selectedDisputeDetails.legal_actions.map(action => {
                      const Icon = getActionTypeIcon(action.action_type);
                      return (
                        <div key={action.id} className="flex gap-3">
                          <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {action.action_type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(action.issued_at || ''), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Select a dispute to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Dispute Modal */}
      {showAddDisputeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-xl font-semibold mb-4">Record New Dispute</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                await addDispute({
                  lease_id: formData.get('lease') as string,
                  category: formData.get('category') as any,
                  description: formData.get('description') as string,
                });
                setShowAddDisputeModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lease / Tenant *
                </label>
                <select
                  name="lease"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select lease</option>
                  {leases
                    .filter(l => l.status === 'active')
                    .map(lease => {
                      const tenant = tenants.find(t => t.lease_id === lease.id);
                      const unit = units.find(u => u.id === lease.unit_id);
                      return (
                        <option key={lease.id} value={lease.id}>
                          {tenant?.full_name} - {unit?.unit_identifier}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select category</option>
                  <option value="rent_arrears">Rent Arrears</option>
                  <option value="property_damage">Property Damage</option>
                  <option value="noise">Noise Complaints</option>
                  <option value="deposit">Deposit Dispute</option>
                  <option value="harassment">Harassment</option>
                  <option value="repairs">Repairs & Maintenance</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description *
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Describe the dispute in detail..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDisputeModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Record Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Legal Action Modal */}
      {showAddActionModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full">
            <h2 className="text-xl font-semibold mb-4">Issue Legal Notice</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const responseDeadline = formData.get('deadline');
                await addLegalAction({
                  lease_id: formData.get('lease') as string,
                  dispute_id: formData.get('dispute') || null,
                  action_type: formData.get('type') as any,
                  response_deadline: responseDeadline ? new Date(responseDeadline as string).toISOString() : null,
                  agent_reasoning: formData.get('reasoning') as string,
                });
                setShowAddActionModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lease / Tenant *
                </label>
                <select
                  name="lease"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select lease</option>
                  {leases
                    .filter(l => l.status === 'active')
                    .map(lease => {
                      const tenant = tenants.find(t => t.lease_id === lease.id);
                      const unit = units.find(u => u.id === lease.unit_id);
                      return (
                        <option key={lease.id} value={lease.id}>
                          {tenant?.full_name} - {unit?.unit_identifier}
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Related Dispute
                </label>
                <select
                  name="dispute"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">None</option>
                  {disputes
                    .filter(d => d.status !== 'closed')
                    .map(dispute => (
                      <option key={dispute.id} value={dispute.id}>
                        {dispute.category.replace(/_/g, ' ')} - {format(new Date(dispute.opened_at || ''), 'MMM d')}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Action Type *
                </label>
                <select
                  name="type"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select type</option>
                  <option value="formal_notice">Formal Notice</option>
                  <option value="section_8">Section 8 Notice</option>
                  <option value="section_21">Section 21 Notice</option>
                  <option value="eviction_notice">Eviction Notice</option>
                  <option value="payment_demand">Payment Demand</option>
                  <option value="deposit_deduction_notice">Deposit Deduction Notice</option>
                  <option value="payment_plan_agreement">Payment Plan Agreement</option>
                  <option value="lease_violation_notice">Lease Violation Notice</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Response Deadline
                </label>
                <input
                  type="date"
                  name="deadline"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Reasoning *
                </label>
                <textarea
                  name="reasoning"
                  required
                  rows={3}
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Explain why this action is being taken..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddActionModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Issue Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}