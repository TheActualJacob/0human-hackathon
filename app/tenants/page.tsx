'use client';

import { useState } from "react";
import { Users, Search, AlertTriangle, TrendingUp } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import DrawerPanel from "@/components/shared/DrawerPanel";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import useStore from "@/lib/store/useStore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function TenantsPage() {
  const { tenants, rentPayments, leases, selectedTenant, setSelectedTenant } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Filter tenants
  const filteredTenants = tenants.filter(tenant => 
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedTenantData = tenants.find(t => t.id === selectedTenant);
  const selectedTenantLease = selectedTenantData 
    ? leases.find(l => l.tenantId === selectedTenantData.id)
    : null;

  const getRiskBadge = (score: number) => {
    if (score < 20) return { label: "Low Risk", className: "bg-green-500/10 text-green-500" };
    if (score < 50) return { label: "Medium Risk", className: "bg-yellow-500/10 text-yellow-500" };
    return { label: "High Risk", className: "bg-red-500/10 text-red-500" };
  };

  const columns = [
    {
      key: 'name',
      header: 'Tenant',
      accessor: (tenant) => (
        <div>
          <p className="font-medium">{tenant.name}</p>
          <p className="text-sm text-muted-foreground">{tenant.email}</p>
        </div>
      )
    },
    {
      key: 'unit',
      header: 'Unit',
      accessor: (tenant) => <span className="font-medium">{tenant.unit}</span>
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      accessor: (tenant) => <span>${tenant.rentAmount.toLocaleString()}</span>
    },
    {
      key: 'status',
      header: 'Payment Status',
      accessor: (tenant) => (
        <Badge 
          variant="outline" 
          className={cn(
            tenant.paymentStatus === 'current' && "border-green-500/20 text-green-500",
            tenant.paymentStatus === 'late' && "border-red-500/20 text-red-500",
            tenant.paymentStatus === 'pending' && "border-yellow-500/20 text-yellow-500"
          )}
        >
          {tenant.paymentStatus}
        </Badge>
      )
    },
    {
      key: 'risk',
      header: 'Risk Score',
      accessor: (tenant) => {
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
      key: 'tenure',
      header: 'Move-in Date',
      accessor: (tenant) => format(new Date(tenant.moveInDate), 'MMM yyyy')
    }
  ];

  const handleRowClick = (tenant) => {
    setSelectedTenant(tenant.id);
    setIsDrawerOpen(true);
  };

  // Calculate tenant payment history
  const getTenantPaymentHistory = (tenantId: string) => {
    const payments = rentPayments.filter(p => p.tenantId === tenantId);
    const paid = payments.filter(p => p.status === 'paid').length;
    const late = payments.filter(p => p.status === 'late').length;
    const total = payments.length;
    
    return { paid, late, total };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Manage tenant information and risk profiles</p>
        </div>
        
        {/* Summary Stats */}
        <div className="flex gap-4">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="font-medium">{tenants.length}</span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">At Risk:</span>
              <span className="font-medium text-yellow-500">
                {tenants.filter(t => t.riskScore > 50).length}
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or unit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tenants Table */}
      <Card className="p-6">
        <DataTable
          columns={columns}
          data={filteredTenants}
          onRowClick={handleRowClick}
          selectedId={selectedTenant}
          getRowId={(tenant) => tenant.id}
          emptyMessage="No tenants found"
        />
      </Card>

      {/* Tenant Details Drawer */}
      <DrawerPanel
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTenant(null);
        }}
        title="Tenant Details"
      >
        {selectedTenantData && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-semibold mb-3">{selectedTenantData.name}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{selectedTenantData.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{selectedTenantData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{selectedTenantData.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="font-medium">${selectedTenantData.rentAmount.toLocaleString()}</span>
                </div>
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
                  AI calculated based on payment history, tenure, and maintenance requests
                </p>
              </div>
            </Card>

            {/* Tabs for detailed info */}
            <Tabs defaultValue="payments" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="lease">Lease</TabsTrigger>
                <TabsTrigger value="notes">AI Notes</TabsTrigger>
              </TabsList>
              
              <TabsContent value="payments" className="space-y-3 mt-4">
                <div className="space-y-2">
                  {(() => {
                    const history = getTenantPaymentHistory(selectedTenantData.id);
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">On-time Payments</span>
                          <span className="text-green-500">{history.paid}/{history.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Late Payments</span>
                          <span className="text-red-500">{history.late}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Payment Status</span>
                          <Badge 
                            variant="outline"
                            className={cn(
                              selectedTenantData.paymentStatus === 'current' && "border-green-500/20 text-green-500",
                              selectedTenantData.paymentStatus === 'late' && "border-red-500/20 text-red-500"
                            )}
                          >
                            {selectedTenantData.paymentStatus}
                          </Badge>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </TabsContent>
              
              <TabsContent value="lease" className="space-y-3 mt-4">
                {selectedTenantLease && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lease Start</span>
                      <span>{format(new Date(selectedTenantLease.startDate), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lease End</span>
                      <span>{format(new Date(selectedTenantLease.endDate), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant="outline">{selectedTenantLease.status}</Badge>
                    </div>
                    {selectedTenantLease.renewalRecommendation && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">AI Renewal Recommendation</p>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedTenantLease.renewalRecommendation} className="h-2 flex-1" />
                          <span className="text-sm font-medium">{selectedTenantLease.renewalRecommendation}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="notes" className="mt-4">
                <div className="space-y-3">
                  <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                    <p className="font-medium mb-1">Payment Behavior</p>
                    <p className="text-muted-foreground">
                      {selectedTenantData.riskScore < 30 
                        ? "Excellent payment history. Low maintenance needs."
                        : selectedTenantData.riskScore < 60
                        ? "Generally reliable with occasional late payments."
                        : "Multiple late payments detected. Consider monitoring closely."}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-3 text-sm">
                    <p className="font-medium mb-1">Renewal Recommendation</p>
                    <p className="text-muted-foreground">
                      {selectedTenantData.riskScore < 30 
                        ? "Strong candidate for lease renewal with standard increase."
                        : selectedTenantData.riskScore < 60
                        ? "Consider renewal with stricter payment terms."
                        : "High risk tenant. Evaluate before renewal."}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DrawerPanel>
    </div>
  );
}