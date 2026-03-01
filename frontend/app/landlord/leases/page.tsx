'use client';

import { useState, useEffect } from 'react';
import {
  FileText, Calendar, TrendingUp, AlertCircle, Plus,
  User, Home, DollarSign, Clock, ChevronRight, Copy, CheckCircle2
} from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useLandlordStore from "@/lib/store/landlord";
import useAuthStore from "@/lib/store/auth";
import { getCurrentUser } from "@/lib/auth/client";
import { createClient } from "@/lib/supabase/client";
import { format, differenceInDays, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

export default function LandlordLeasesPage() {
  const {
    leases,
    units,
    tenants,
    loading,
    fetchLandlordData
  } = useLandlordStore();

  const { user } = useAuthStore();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showNewLeaseDialog, setShowNewLeaseDialog] = useState(false);
  const [selectedLease, setSelectedLease] = useState<string | null>(null);
  const [signingTokens, setSigningTokens] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      let currentUser = user;
      if (!currentUser) {
        currentUser = await getCurrentUser();
        if (currentUser) useAuthStore.getState().setUser(currentUser);
      }
      if (currentUser?.entityId) {
        fetchLandlordData(currentUser.entityId);
      }
      const supabase = createClient();
      const { data } = await supabase
        .from('signing_tokens')
        .select('id, prospect_name, unit_address, monthly_rent, signed_at, created_at')
        .order('created_at', { ascending: false });
      setSigningTokens(data || []);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get unit info for lease
  const getUnitInfo = (unitId: string) => {
    return units.find(u => u.id === unitId);
  };

  // Find a signing token for a lease by matching unit address
  const getSigningToken = (lease: any) => {
    const unit = getUnitInfo(lease.unit_id);
    if (!unit) return null;
    const addr = [unit.unit_identifier, unit.address, unit.city].filter(Boolean).join(', ');
    return signingTokens.find(t => t.unit_address === addr) || null;
  };

  const copySigningLink = (tokenId: string) => {
    const link = `${window.location.origin}/sign/${tokenId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(tokenId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Get tenant info for lease
  const getTenantInfo = (leaseId: string) => {
    return tenants.find(t => t.lease_id === leaseId && t.is_primary_tenant);
  };

  // Calculate days until expiry
  const getDaysUntilExpiry = (endDate: string | null) => {
    if (!endDate) return null;
    return differenceInDays(new Date(endDate), new Date());
  };

  // Filter leases
  const filteredLeases = leases.filter(lease => {
    if (filterStatus === 'all') return true;
    return lease.status === filterStatus;
  });

  // Categorize leases
  const expiringLeases = leases.filter(l => {
    const days = getDaysUntilExpiry(l.end_date);
    return days !== null && days > 0 && days < 90 && l.status === 'active';
  });
  const expiredLeases = leases.filter(l => l.status === 'expired');
  const activeLeases = leases.filter(l => l.status === 'active');
  const totalMonthlyRent = activeLeases.reduce((sum, l) => sum + l.monthly_rent, 0);

  const columns = [
    {
      key: 'tenant',
      header: 'Tenant / Unit',
      accessor: (lease: any) => {
        const tenant = getTenantInfo(lease.id);
        const unit = getUnitInfo(lease.unit_id);
        return (
          <div>
            <p className="font-medium">{tenant?.full_name || 'Vacant'}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Home className="h-3 w-3" />
              {unit?.unit_identifier || unit?.name || 'Unknown Unit'}
            </p>
          </div>
        );
      }
    },
    {
      key: 'dates',
      header: 'Lease Period',
      accessor: (lease: any) => (
        <div className="text-sm">
          <p>{format(new Date(lease.start_date), 'MMM d, yyyy')}</p>
          <p className="text-muted-foreground">
            {lease.end_date 
              ? `to ${format(new Date(lease.end_date), 'MMM d, yyyy')}`
              : 'Open-ended'
            }
          </p>
        </div>
      )
    },
    {
      key: 'rent',
      header: 'Monthly Rent',
      accessor: (lease: any) => (
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">£{lease.monthly_rent.toLocaleString()}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (lease: any) => {
        const days = getDaysUntilExpiry(lease.end_date);
        return (
          <div className="space-y-1">
            <StatusBadge status={lease.status} />
            {days !== null && days > 0 && days < 90 && (
              <p className="text-xs text-orange-400">{days} days left</p>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (lease: any) => {
        if (lease.status === 'pending') {
          const token = getSigningToken(lease);
          if (!token) return <Badge variant="outline" className="text-xs">No signing token</Badge>;
          if (token.signed_at) return (
            <Badge variant="default" className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" />Signed
            </Badge>
          );
          return (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => copySigningLink(token.id)}
            >
              {copiedId === token.id
                ? <><CheckCircle2 className="h-3 w-3 text-green-500" />Copied!</>
                : <><Copy className="h-3 w-3" />Copy Sign Link</>}
            </Button>
          );
        }
        return (
          <Button size="sm" variant="ghost" onClick={() => setSelectedLease(lease.id)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading leases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leases</h1>
          <p className="text-muted-foreground">Manage property leases and tenancies</p>
        </div>
        <Button 
          onClick={() => setShowNewLeaseDialog(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Lease
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Leases</p>
              <h3 className="text-2xl font-bold">{activeLeases.length}</h3>
            </div>
            <FileText className="h-8 w-8 text-primary" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Monthly Income</p>
              <h3 className="text-2xl font-bold">£{totalMonthlyRent.toLocaleString()}</h3>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
              <h3 className="text-2xl font-bold text-orange-500">{expiringLeases.length}</h3>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
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

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('all')}
        >
          All
        </Button>
        <Button
          variant={filterStatus === 'active' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('active')}
        >
          Active
        </Button>
        <Button
          variant={filterStatus === 'expired' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('expired')}
        >
          Expired
        </Button>
        <Button
          variant={filterStatus === 'draft' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('draft')}
        >
          Draft
        </Button>
        <Button
          variant={filterStatus === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('pending')}
        >
          Pending
        </Button>
      </div>

      {/* Expiring Soon Alert */}
      {expiringLeases.length > 0 && (
        <Card className="p-4 border-orange-500/20 bg-orange-500/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <div className="flex-1">
              <p className="font-medium text-orange-500">Leases Expiring Soon</p>
              <p className="text-sm text-muted-foreground">
                {expiringLeases.length} lease{expiringLeases.length > 1 ? 's' : ''} will expire in the next 90 days
              </p>
            </div>
            <Button size="sm" variant="outline">
              Review All
            </Button>
          </div>
        </Card>
      )}

      {/* Leases Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">All Leases</h3>
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        </div>
        
        {filteredLeases.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No leases found</p>
            <Button 
              onClick={() => setShowNewLeaseDialog(true)}
              variant="outline"
            >
              Create your first lease
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredLeases}
            getRowId={(lease) => lease.id}
            emptyMessage="No leases found"
          />
        )}
      </Card>

      {/* Lease Renewal Opportunities */}
      {expiringLeases.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Renewal Opportunities
            </h3>
            <Badge className="bg-orange-500/10 text-orange-500">
              {expiringLeases.length} expiring
            </Badge>
          </div>
          
          <div className="space-y-3">
            {expiringLeases.slice(0, 5).map(lease => {
              const tenant = getTenantInfo(lease.id);
              const unit = getUnitInfo(lease.unit_id);
              const daysLeft = getDaysUntilExpiry(lease.end_date);
              
              return (
                <div key={lease.id} className="p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{tenant?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">
                        {unit?.unit_identifier || unit?.name} • £{lease.monthly_rent}/month
                      </p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>Time remaining</span>
                          <span className="text-orange-400">{daysLeft} days</span>
                        </div>
                        <Progress 
                          value={((90 - (daysLeft || 0)) / 90) * 100} 
                          className="h-2"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        Contact Tenant
                      </Button>
                      <Button size="sm">
                        Renew Lease
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* New Lease Dialog */}
      <Dialog open={showNewLeaseDialog} onOpenChange={setShowNewLeaseDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Lease</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.unit_identifier || unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Monthly Rent</Label>
                <Input type="number" placeholder="1500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Tenant Name</Label>
              <Input placeholder="John Doe" />
            </div>
            
            <div className="space-y-2">
              <Label>Tenant Email</Label>
              <Input type="email" placeholder="john@example.com" />
            </div>
            
            <div className="space-y-2">
              <Label>Tenant Phone</Label>
              <Input placeholder="+44 7XXX XXXXXX" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
              </div>
              
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" defaultValue={format(addMonths(new Date(), 12), 'yyyy-MM-dd')} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Deposit Amount</Label>
              <Input type="number" placeholder="1500" />
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowNewLeaseDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowNewLeaseDialog(false)}>
                Create Lease
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}