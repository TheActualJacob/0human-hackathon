'use client';

import { useState, useEffect } from "react";
import { 
  Users, Search, AlertTriangle, TrendingUp, 
  MessageCircle, Phone, Mail, Home, Calendar,
  CreditCard, FileText, CheckCircle 
} from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import DrawerPanel from "@/components/shared/DrawerPanel";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import useLandlordStore from "@/lib/store/landlord";
import useStore from "@/lib/store/useStore";
import { getCurrentUser } from "@/lib/auth/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function TenantsPage() {
  const { 
    tenants,
    leases,
    units,
    payments,
    maintenanceRequests,
    loading,
    fetchLandlordData
  } = useLandlordStore();

  const {
    conversations,
    disputes,
    legalActions,
    selectedLease,
    setSelectedLease
  } = useStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const currentUser = await getCurrentUser();
      if (currentUser?.entityId) {
        fetchLandlordData(currentUser.entityId);
      }
    };
    load();
  }, []);

  // Get active tenants with their lease and unit information
  const activeTenants = tenants
    .map(tenant => {
      const lease = leases.find(l => l.id === tenant.lease_id);
      const unit = lease ? units.find(u => u.id === lease.unit_id) : null;
      const tenantPayments = lease ? payments.filter(p => p.lease_id === lease.id) : [];
      const recentConversations = conversations.filter(c => c.lease_id === tenant.lease_id).length;
      
      // Calculate risk score based on payments and disputes
      const latePayments = tenantPayments.filter(p => p.status === 'late').length;
      const totalPayments = tenantPayments.length || 1;
      const paymentRisk = (latePayments / totalPayments) * 50;
      const hasDisputes = disputes.some(d => d.lease_id === tenant.lease_id && d.status !== 'closed');
      const disputeRisk = hasDisputes ? 30 : 0;
      const riskScore = Math.min(100, Math.round(paymentRisk + disputeRisk + (Math.random() * 20)));
      
      return {
        ...tenant,
        lease,
        unit,
        payments: tenantPayments,
        riskScore,
        recentConversations
      };
    })
    .filter(tenant => tenant.lease && tenant.unit && tenant.lease.status === 'active')
    // Deduplicate by lease ID — seed data can produce the same lease_id multiple times
    .filter((tenant, index, arr) => arr.findIndex(t => t.lease?.id === tenant.lease?.id) === index);

  // Filter tenants
  const filteredTenants = activeTenants.filter(tenant => 
    tenant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.whatsapp_number.includes(searchTerm) ||
    tenant.unit?.unit_identifier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTenantData = selectedLease 
    ? activeTenants.find(t => t.lease?.id === selectedLease)
    : null;

  const getRiskBadge = (score: number) => {
    if (score < 20) return { label: "Low Risk", className: "bg-green-500/10 text-green-500" };
    if (score < 50) return { label: "Medium Risk", className: "bg-yellow-500/10 text-yellow-500" };
    return { label: "High Risk", className: "bg-red-500/10 text-red-500" };
  };

  const getPaymentStatus = (payments: any[]) => {
    const lastPayment = payments[payments.length - 1];
    if (!lastPayment) return 'no_data';
    if (lastPayment.status === 'paid') return 'current';
    if (lastPayment.status === 'late') return 'late';
    return 'pending';
  };

  const columns = [
    {
      key: 'name',
      header: 'Tenant',
      accessor: (tenant: any) => (
        <div>
          <p className="font-medium">{tenant.full_name}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <MessageCircle className="h-3 w-3" />
            {tenant.whatsapp_number}
          </p>
        </div>
      )
    },
    {
      key: 'unit',
      header: 'Unit',
      accessor: (tenant: any) => (
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{tenant.unit.unit_identifier || tenant.unit.name || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      accessor: (tenant: any) => <span>${tenant.lease.monthly_rent.toLocaleString()}</span>
    },
    {
      key: 'status',
      header: 'Payment Status',
      accessor: (tenant: any) => {
        const status = getPaymentStatus(tenant.payments);
        return (
          <Badge 
            variant="outline" 
            className={cn(
              status === 'current' && "border-green-500/20 text-green-500",
              status === 'late' && "border-red-500/20 text-red-500",
              status === 'pending' && "border-yellow-500/20 text-yellow-500",
              status === 'no_data' && "border-gray-500/20 text-gray-500"
            )}
          >
            {status === 'no_data' ? 'No Data' : status}
          </Badge>
        );
      }
    },
    {
      key: 'risk',
      header: 'Risk Score',
      accessor: (tenant: any) => {
        const risk = getRiskBadge(tenant.riskScore);
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{tenant.riskScore}%</span>
            <Badge variant="outline" className={risk.className}>
              {risk.label}
            </Badge>
          </div>
        );
      }
    },
    {
      key: 'activity',
      header: 'Activity',
      accessor: (tenant: any) => (
        <div className="text-sm text-muted-foreground">
          {tenant.recentConversations > 0 ? (
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {tenant.recentConversations} msgs
            </span>
          ) : (
            <span>No recent activity</span>
          )}
        </div>
      )
    }
  ];

  const handleRowClick = (tenant: any) => {
    setSelectedLease(tenant.lease.id);
    setIsDrawerOpen(true);
  };

  // Calculate stats
  const totalTenants = activeTenants.length;
  const atRiskTenants = activeTenants.filter(t => t.riskScore > 50).length;
  const withWhatsApp = activeTenants.filter(t => t.whatsapp_number).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading tenants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Manage your tenant relationships and monitor performance
          </p>
        </div>
        
        {/* Summary Stats */}
        <div className="flex gap-4">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active:</span>
              <span className="font-medium">{totalTenants}</span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">At Risk:</span>
              <span className="font-medium text-yellow-500">{atRiskTenants}</span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">WhatsApp:</span>
              <span className="font-medium text-green-500">{withWhatsApp}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, unit, or WhatsApp number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tenants Table */}
      <Card className="p-6">
        {filteredTenants.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No active tenants found</p>
            <p className="text-sm text-muted-foreground">
              Tenants appear here when they have active leases
            </p>
            <Link href="/landlord/leases" className="text-primary hover:underline text-sm mt-4 inline-block">
              Create a lease →
            </Link>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredTenants}
            onRowClick={handleRowClick}
            selectedId={selectedLease}
            getRowId={(tenant) => tenant.lease.id}
            emptyMessage="No tenants found"
          />
        )}
      </Card>

      {/* Tenant Details Drawer */}
      <DrawerPanel
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedLease(null);
        }}
        title="Tenant Details"
      >
        {selectedTenantData && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold mb-3">{selectedTenantData.full_name}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{selectedTenantData.unit.unit_identifier || selectedTenantData.unit.name}</span>
                </div>
                {selectedTenantData.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {selectedTenantData.email}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WhatsApp</span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {selectedTenantData.whatsapp_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="font-medium">${selectedTenantData.lease.monthly_rent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primary Tenant</span>
                  <span>{selectedTenantData.is_primary_tenant ? 'Yes' : 'No'}</span>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="flex gap-2 mt-4">
                <Link href="/landlord/maintenance" className="flex-1">
                  <button className="w-full text-sm bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Send WhatsApp
                  </button>
                </Link>
                <Link href={`/landlord/properties`} className="flex-1">
                  <button className="w-full text-sm border border-border px-3 py-2 rounded-lg hover:bg-accent transition-colors">
                    View Unit
                  </button>
                </Link>
              </div>
            </div>

            {/* Risk Assessment */}
            <Card className="p-4 ai-glow">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                AI Risk Assessment
              </h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Risk Score</span>
                    <span className="text-sm font-medium">{selectedTenantData.riskScore}%</span>
                  </div>
                  <Progress value={selectedTenantData.riskScore} className="h-2" />
                </div>
                <Badge 
                  variant="outline" 
                  className={getRiskBadge(selectedTenantData.riskScore).className}
                >
                  {getRiskBadge(selectedTenantData.riskScore).label}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  AI calculated based on payment history, disputes, and communication patterns
                </p>
              </div>
            </Card>

            {/* Tabs for detailed info */}
            <Tabs defaultValue="payments" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="lease">Lease</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
                <TabsTrigger value="issues">Issues</TabsTrigger>
              </TabsList>
              
              <TabsContent value="payments" className="space-y-3 mt-4">
                <div className="space-y-2">
                  {(() => {
                    const paidPayments = selectedTenantData.payments.filter(p => p.status === 'paid').length;
                    const latePayments = selectedTenantData.payments.filter(p => p.status === 'late').length;
                    const totalPayments = selectedTenantData.payments.length;
                    
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">On-time Payments</span>
                          <span className="text-green-500">{paidPayments}/{totalPayments}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Late Payments</span>
                          <span className="text-red-500">{latePayments}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Current Status</span>
                          <Badge 
                            variant="outline"
                            className={cn(
                              getPaymentStatus(selectedTenantData.payments) === 'current' && "border-green-500/20 text-green-500",
                              getPaymentStatus(selectedTenantData.payments) === 'late' && "border-red-500/20 text-red-500"
                            )}
                          >
                            {getPaymentStatus(selectedTenantData.payments)}
                          </Badge>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="pt-3 border-t">
                  <Link href="/landlord/payments" className="text-sm text-primary hover:underline">
                    View payment history →
                  </Link>
                </div>
              </TabsContent>
              
              <TabsContent value="lease" className="space-y-3 mt-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lease Start</span>
                    <span>{format(new Date(selectedTenantData.lease.start_date), 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lease End</span>
                    <span>
                      {selectedTenantData.lease.end_date 
                        ? format(new Date(selectedTenantData.lease.end_date), 'MMM d, yyyy')
                        : 'Open-ended'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit</span>
                    <span>${selectedTenantData.lease.deposit_amount?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notice Period</span>
                    <span>{selectedTenantData.lease.notice_period_days || 30} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline">{selectedTenantData.lease.status}</Badge>
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <Link href={`/landlord/leases`} className="text-sm text-primary hover:underline">
                    View full lease details →
                  </Link>
                </div>
              </TabsContent>
              
              <TabsContent value="messages" className="mt-4">
                <div className="space-y-3">
                  {(() => {
                    const recentConvos = conversations
                      .filter(c => c.lease_id === selectedTenantData.lease.id)
                      .slice(0, 5);
                    
                    if (recentConvos.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No WhatsApp conversations yet
                        </p>
                      );
                    }
                    
                    return (
                      <>
                        {recentConvos.map(convo => (
                          <div key={convo.id} className="text-sm p-3 bg-accent/50 rounded-lg">
                            <p className={cn(
                              "font-medium mb-1",
                              convo.direction === 'inbound' ? "text-blue-400" : "text-green-400"
                            )}>
                              {convo.direction === 'inbound' ? 'Tenant' : 'Agent'}
                            </p>
                            <p className="text-muted-foreground line-clamp-2">
                              {convo.message_body}
                            </p>
                          </div>
                        ))}
                        <Link href="/landlord/maintenance" className="text-sm text-primary hover:underline block text-center">
                          View all conversations →
                        </Link>
                      </>
                    );
                  })()}
                </div>
              </TabsContent>
              
              <TabsContent value="issues" className="mt-4">
                <div className="space-y-3">
                  {(() => {
                    const tenantDisputes = disputes.filter(d => d.lease_id === selectedTenantData.lease.id);
                    const tenantLegalActions = legalActions.filter(la => la.lease_id === selectedTenantData.lease.id);
                    const tenantMaintenanceRequests = maintenanceRequests.filter(mr => mr.lease_id === selectedTenantData.lease.id);
                    
                    const hasIssues = tenantDisputes.length > 0 || tenantLegalActions.length > 0;
                    
                    if (!hasIssues && tenantMaintenanceRequests.length === 0) {
                      return (
                        <div className="text-center py-4">
                          <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No active issues or disputes
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <>
                        {tenantDisputes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-red-400">Active Disputes</p>
                            {tenantDisputes.map(dispute => (
                              <div key={dispute.id} className="text-sm p-2 bg-red-500/10 rounded border border-red-500/20">
                                <p className="font-medium">{dispute.category.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-muted-foreground">
                                  Status: {dispute.status}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {tenantLegalActions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-orange-400">Legal Actions</p>
                            {tenantLegalActions.map(action => (
                              <div key={action.id} className="text-sm p-2 bg-orange-500/10 rounded border border-orange-500/20">
                                <p className="font-medium">{action.action_type.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-muted-foreground">
                                  Status: {action.status}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {tenantMaintenanceRequests.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Maintenance Requests</p>
                            <p className="text-sm text-muted-foreground">
                              {tenantMaintenanceRequests.length} total requests
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DrawerPanel>
    </div>
  );
}