'use client';

import { FileText, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import useStore from "@/lib/store/useStore";
import { format, differenceInDays } from "date-fns";
import type { Lease } from "@/types";

export default function LeasesPage() {
  const { leases, tenants, units } = useStore();

  const getTenantForLease = (leaseId: string) =>
    tenants.find(t => t.lease_id === leaseId);

  const getUnitForLease = (unitId: string) =>
    units.find(u => u.id === unitId);

  const getDaysUntilExpiry = (endDate: string | null) => {
    if (!endDate) return null;
    return differenceInDays(new Date(endDate), new Date());
  };

  const isExpiringSoon = (lease: Lease) => {
    if (lease.status !== 'active' || !lease.end_date) return false;
    const days = getDaysUntilExpiry(lease.end_date);
    return days !== null && days <= 60 && days >= 0;
  };

  const activeLeases = leases.filter(l => l.status === 'active');
  const expiringSoonLeases = leases.filter(isExpiringSoon);
  const expiredLeases = leases.filter(l => l.status === 'expired');

  const columns = [
    {
      key: 'tenant',
      header: 'Tenant',
      accessor: (lease: Lease) => {
        const tenant = getTenantForLease(lease.id);
        const unit = getUnitForLease(lease.unit_id);
        return tenant ? (
          <div>
            <p className="font-medium">{tenant.full_name}</p>
            <p className="text-sm text-muted-foreground">Unit {unit?.unit_identifier ?? '—'}</p>
          </div>
        ) : <span className="text-muted-foreground">—</span>;
      }
    },
    {
      key: 'dates',
      header: 'Lease Period',
      accessor: (lease: Lease) => (
        <div className="text-sm">
          <p>{format(new Date(lease.start_date), 'MMM d, yyyy')}</p>
          {lease.end_date && (
            <p className="text-muted-foreground">to {format(new Date(lease.end_date), 'MMM d, yyyy')}</p>
          )}
        </div>
      )
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      accessor: (lease: Lease) => <span className="font-medium">${lease.monthly_rent.toLocaleString()}</span>
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (lease: Lease) => {
        const daysLeft = getDaysUntilExpiry(lease.end_date);
        const expiring = isExpiringSoon(lease);
        return (
          <div className="space-y-1">
            <StatusBadge
              status={lease.status === 'active' ? (expiring ? 'pending' : 'active') : 'late'}
            />
            {expiring && daysLeft !== null && (
              <p className="text-xs text-muted-foreground">{daysLeft} days left</p>
            )}
          </div>
        );
      }
    },
    {
      key: 'deposit',
      header: 'Deposit',
      accessor: (lease: Lease) => (
        <span className="text-sm">
          {lease.deposit_amount ? `£${lease.deposit_amount.toLocaleString()}` : '—'}
        </span>
      )
    },
    {
      key: 'action',
      header: 'Action',
      accessor: (lease: Lease) => {
        if (lease.status === 'expired') {
          return <Badge variant="destructive">Expired</Badge>;
        }
        if (isExpiringSoon(lease)) {
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
      <div>
        <h1 className="text-2xl font-bold">Lease Management</h1>
        <p className="text-muted-foreground">Track lease agreements and renewal opportunities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-sm text-muted-foreground">Expiring Within 60 Days</p>
              <h3 className="text-2xl font-bold text-yellow-500">{expiringSoonLeases.length}</h3>
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
      </div>

      {expiringSoonLeases.length > 0 && (
        <Card className="p-4 border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-500">Leases Expiring Soon</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {expiringSoonLeases.length} lease{expiringSoonLeases.length > 1 ? 's' : ''} will expire within 60 days.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">All Leases</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors">
              Export
            </button>
            <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors ai-glow">
              AI Analysis
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
    </div>
  );
}
