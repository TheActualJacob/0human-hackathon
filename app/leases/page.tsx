'use client';

import { FileText, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import useStore from "@/lib/store/useStore";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

export default function LeasesPage() {
  const { leases, tenants } = useStore();

  // Get tenant info for lease
  const getTenantInfo = (tenantId: string | null) => {
    if (!tenantId) return null;
    return tenants.find(t => t.id === tenantId);
  };

  // Calculate days until expiry
  const getDaysUntilExpiry = (endDate: Date) => {
    return differenceInDays(new Date(endDate), new Date());
  };

  // Categorize leases
  const expiringLeases = leases.filter(l => l.status === 'expiring');
  const expiredLeases = leases.filter(l => l.status === 'expired');
  const activeLeases = leases.filter(l => l.status === 'active');

  const columns = [
    {
      key: 'tenant',
      header: 'Tenant',
      accessor: (lease) => {
        const tenant = getTenantInfo(lease.tenant_id);
        return tenant ? (
          <div>
            <p className="font-medium">{tenant.name}</p>
            <p className="text-sm text-muted-foreground">Unit {lease.unit}</p>
          </div>
        ) : <span>-</span>;
      }
    },
    {
      key: 'dates',
      header: 'Lease Period',
      accessor: (lease) => (
        <div className="text-sm">
          <p>{format(new Date(lease.start_date), 'MMM d, yyyy')}</p>
          <p className="text-muted-foreground">to {format(new Date(lease.end_date), 'MMM d, yyyy')}</p>
        </div>
      )
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      accessor: (lease) => <span className="font-medium">${lease.monthly_rent.toLocaleString()}</span>
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (lease) => {
        const daysLeft = getDaysUntilExpiry(lease.end_date);
        return (
          <div className="space-y-1">
            <StatusBadge 
              status={lease.status === 'active' ? 'active' : 
                     lease.status === 'expiring' ? 'pending' : 'late'} 
            />
            {lease.status === 'expiring' && (
              <p className="text-xs text-muted-foreground">{daysLeft} days left</p>
            )}
          </div>
        );
      }
    },
    {
      key: 'renewal',
      header: 'AI Renewal Score',
      accessor: (lease) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Progress value={lease.renewal_recommendation || 0} className="h-2 w-20" />
            <span className="text-sm font-medium">{lease.renewal_recommendation || 0}%</span>
          </div>
          {lease.suggested_rent_increase !== undefined && lease.suggested_rent_increase !== null && lease.suggested_rent_increase > 0 && (
            <p className="text-xs text-primary">+{lease.suggested_rent_increase}% suggested</p>
          )}
        </div>
      )
    },
    {
      key: 'action',
      header: 'Action',
      accessor: (lease) => {
        if (lease.status === 'expired') {
          return <Badge variant="destructive">Expired</Badge>;
        }
        if (lease.status === 'expiring') {
          return (
            <button className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors">
              Renew
            </button>
          );
        }
        return <span className="text-sm text-muted-foreground">Active</span>;
      }
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Lease Management</h1>
        <p className="text-muted-foreground">Track lease agreements and renewal opportunities</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Leases</p>
              <h3 className="text-2xl font-bold">{activeLeases.length}</h3>
            </div>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
              <h3 className="text-2xl font-bold text-yellow-500">{expiringLeases.length}</h3>
            </div>
            <Calendar className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <h3 className="text-2xl font-bold text-red-500">{expiredLeases.length}</h3>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>

        <Card className="p-6 ai-glow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Renewal Rate</p>
              <h3 className="text-2xl font-bold text-primary">
                {leases.length > 0 ? Math.round(
                  leases.reduce((sum, l) => sum + (l.renewal_recommendation || 0), 0) / leases.length
                ) : 0}%
              </h3>
            </div>
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Expiring Soon Alert */}
      {expiringLeases.length > 0 && (
        <Card className="p-4 border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-yellow-500">Leases Expiring Soon</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {expiringLeases.length} lease{expiringLeases.length > 1 ? 's' : ''} will expire in the next 60 days.
                AI recommends focusing on high-renewal-probability tenants first.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Leases Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">All Leases</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors">
              Export
            </button>
            <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors ai-glow">
              AI Renewal Analysis
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={leases}
          getRowId={(lease) => lease.id}
          emptyMessage="No leases found"
        />
      </Card>

      {/* AI Recommendations */}
      <Card className="p-6 ai-glow">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          AI Renewal Recommendations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leases
            .filter(l => l.status === 'expiring' && l.renewal_recommendation && l.renewal_recommendation > 80)
            .slice(0, 4)
            .map(lease => {
              const tenant = getTenantInfo(lease.tenant_id);
              return (
                <div key={lease.id} className="p-4 rounded-lg bg-secondary/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{tenant?.name}</p>
                      <p className="text-sm text-muted-foreground">Unit {lease.unit}</p>
                    </div>
                    <Badge className="bg-green-500/10 text-green-500">
                      {lease.renewal_recommendation}% likely
                    </Badge>
                  </div>
                  <p className="text-sm mt-2">
                    Suggested increase: <span className="font-medium text-primary">{lease.suggested_rent_increase}%</span>
                  </p>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}