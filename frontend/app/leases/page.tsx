'use client';

import { useState, useEffect } from "react";
import { FileText, Calendar, TrendingUp, AlertCircle, Bot, ChevronDown, ChevronUp, Save, ExternalLink } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import useStore from "@/lib/store/useStore";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

const EXAMPLE_LEASE_TEMPLATE = `ASSURED SHORTHOLD TENANCY AGREEMENT

Parties
- Landlord: [Landlord Name]
- Tenant(s): [Tenant Name(s)]
- Property: [Full Property Address]

Term
- Start Date: [Start Date]
- End Date: [End Date] (fixed term)
- Monthly Rent: £[Amount], payable in advance on the [Day] of each month

Deposit
- Deposit Amount: £[Amount]
- Deposit Scheme: [Scheme Name, e.g. DPS / TDS / mydeposits]
- Deposit Reference: [Reference Number]

Key Obligations — Tenant
1. Pay rent on time each month.
2. Keep the property clean and in good condition.
3. Report maintenance issues promptly.
4. Not sublet or assign without prior written consent.
5. Not make alterations to the property without written consent.
6. Allow access for inspections with 24 hours written notice.
7. Not cause nuisance to neighbours.

Key Obligations — Landlord
1. Keep the structure and exterior in repair.
2. Ensure all gas, electrical, and heating systems are safe and serviced annually.
3. Protect the deposit in an approved scheme within 30 days.
4. Respond to urgent repair requests within 24 hours.
5. Respond to routine repair requests within 28 days.

Notice Periods
- Tenant must give [X] weeks written notice to end the tenancy.
- Landlord must follow statutory notice procedures (Section 8 or Section 21).

Special Conditions
[Add any additional agreed terms here, e.g. pets allowed, parking arrangements, gardening responsibilities, etc.]

Governing Law: England & Wales`;

export default function LeasesPage() {
  const { leases, tenants, updateLease } = useStore();
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [agreementText, setAgreementText] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const selectedLease = leases.find(l => l.id === selectedLeaseId) || null;

  useEffect(() => {
    if (selectedLease) {
      setAgreementText(selectedLease.special_terms || EXAMPLE_LEASE_TEMPLATE);
      setSaveSuccess(false);
    }
  }, [selectedLeaseId]);

  const handleSave = async () => {
    if (!selectedLeaseId) return;
    setSaving(true);
    setSaveSuccess(false);
    await updateLease(selectedLeaseId, { special_terms: agreementText });
    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

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
        const isSelected = selectedLeaseId === lease.id;
        const hasAgreement = !!(lease.special_terms && lease.special_terms.trim());
        return (
          <div className="flex items-center gap-2">
            {lease.status === 'expired' ? (
              <Badge variant="destructive">Expired</Badge>
            ) : lease.status === 'expiring' ? (
              <button className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors">
                Renew
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">Active</span>
            )}
            <button
              onClick={() => setSelectedLeaseId(isSelected ? null : lease.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                isSelected
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              <FileText className="h-3 w-3" />
              {hasAgreement ? "Edit Agreement" : "Add Agreement"}
              {isSelected ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        );
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

      {/* Lease Agreement Editor */}
      {selectedLease && (
        <Card className="p-6 border-primary/30">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Lease Agreement
                {selectedLease.special_terms && (
                  <Badge className="bg-green-500/10 text-green-500 text-xs">Saved</Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {(() => {
                  const tenant = getTenantInfo(selectedLease.tenant_id);
                  return tenant
                    ? `${tenant.name} — Unit ${selectedLease.unit_identifier || selectedLease.unit_id}`
                    : `Lease ${selectedLease.id.slice(0, 8)}`;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedLease.lease_document_url && (
                <a
                  href={selectedLease.lease_document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View PDF
                </a>
              )}
              <button
                onClick={() => setSelectedLeaseId(null)}
                className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Agent visibility indicator */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-primary">The WhatsApp agent reads this.</span>{" "}
              Whatever you write here will be included in the agent's context every time it talks to this tenant — it can cite clauses, reference obligations, and answer lease-related questions.
            </p>
          </div>

          <Textarea
            value={agreementText}
            onChange={(e) => { setAgreementText(e.target.value); setSaveSuccess(false); }}
            className="min-h-[400px] font-mono text-sm resize-y"
            placeholder="Enter the lease agreement terms here..."
          />

          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Plain text only. The agent will read this verbatim as context.
            </p>
            <div className="flex items-center gap-3">
              {saveSuccess && (
                <span className="text-xs text-green-500">Saved — agent will use the updated terms.</span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Agreement"}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}