'use client';

import { useEffect } from 'react';
import { 
  Home, DollarSign, Wrench, FileText, 
  Calendar, Clock, AlertCircle, CheckCircle 
} from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import useTenantStore from '@/lib/store/tenant';
import useAuthStore from '@/lib/store/auth';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/client';

export default function TenantDashboard() {
  const { user, setUser } = useAuthStore();
  const { 
    tenantInfo,
    payments,
    maintenanceRequests,
    loading,
    fetchTenantData
  } = useTenantStore();

  // Fetch authenticated user and their data
  useEffect(() => {
    async function loadUserData() {
      // Use a local variable so we can call fetchTenantData immediately
      // without waiting for the next render (stale closure fix)
      let activeUser = user;

      if (!activeUser) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          activeUser = currentUser;
        }
      }

      if (activeUser?.entityId) {
        fetchTenantData(activeUser.entityId);
      }
    }

    loadUserData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Calculate metrics
  const nextPaymentDue = payments
    .filter(p => p.status !== 'paid')
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const overduePayments = payments.filter(p => 
    p.status !== 'paid' && new Date(p.due_date) < new Date()
  ).length;

  const totalPaidThisYear = payments
    .filter(p => {
      const paymentDate = new Date(p.payment_date || '');
      return p.status === 'paid' && 
        paymentDate.getFullYear() === new Date().getFullYear();
    })
    .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  const activeMaintenanceRequests = maintenanceRequests.filter(r => 
    ['open', 'assigned', 'in_progress'].includes(r.status || '')
  ).length;

  const completedRequests = maintenanceRequests.filter(r => 
    r.status === 'completed' || r.status === 'resolved'
  ).length;

  // Calculate days until lease end
  const hasLease = !!tenantInfo?.leases;
  const daysUntilLeaseEnd = hasLease
    ? Math.floor((new Date(tenantInfo.leases.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!tenantInfo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <Home className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">No tenant profile found</h2>
          <p className="text-muted-foreground text-sm">
            Your account doesn't have a tenant profile linked yet. Browse available properties to apply, or contact your landlord.
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/properties" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
              Browse Properties
            </a>
            <a href="/auth/login" className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">
              Switch Account
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {tenantInfo.full_name}</h1>
        <p className="text-muted-foreground">
          {hasLease
            ? `${tenantInfo.leases?.units?.name} - ${tenantInfo.leases?.units?.address}`
            : 'No active lease — browse available properties or wait for an invite from your landlord'
          }
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Next Payment Due"
          value={nextPaymentDue 
            ? format(new Date(nextPaymentDue.due_date), 'MMM d')
            : 'No payments due'
          }
          icon={Calendar}
          description={nextPaymentDue 
            ? `$${nextPaymentDue.amount_due.toLocaleString()}`
            : 'All payments complete'
          }
          className={overduePayments > 0 ? "border-red-500/50" : ""}
        />
        
        <KPICard
          title="Monthly Rent"
          value={hasLease ? `$${tenantInfo.leases?.rent_amount?.toLocaleString() || 0}` : 'N/A'}
          icon={DollarSign}
          description={hasLease ? `Paid: $${totalPaidThisYear.toLocaleString()} this year` : 'No active lease'}
        />

        <KPICard
          title="Maintenance Requests"
          value={activeMaintenanceRequests}
          icon={Wrench}
          description={`${completedRequests} completed`}
          highlight={activeMaintenanceRequests > 0}
        />

        <KPICard
          title="Lease Status"
          value={hasLease ? (daysUntilLeaseEnd > 90 ? 'Active' : 'Ending Soon') : 'No Lease'}
          icon={FileText}
          description={hasLease ? `${daysUntilLeaseEnd} days remaining` : 'Apply for a property'}
          className={hasLease && daysUntilLeaseEnd < 90 ? "border-orange-500/50" : ""}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Property Details - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lease Information */}
          {hasLease ? (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Lease Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Property</p>
                  <p className="font-medium">{tenantInfo.leases?.units?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{tenantInfo.leases?.units?.address}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lease Start</p>
                  <p className="font-medium">
                    {format(new Date(tenantInfo.leases!.start_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lease End</p>
                  <p className="font-medium">
                    {format(new Date(tenantInfo.leases!.end_date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Rent</p>
                  <p className="font-medium">${tenantInfo.leases?.rent_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Security Deposit</p>
                  <p className="font-medium">${tenantInfo.leases?.security_deposit?.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Lease Information</h2>
              <p className="text-muted-foreground text-center py-4">
                No active lease. Browse available properties or contact your landlord for an invite.
              </p>
            </div>
          )}

          {/* Recent Payments */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Payments</h2>
              <Link href="/tenant/payments" className="text-sm text-primary hover:underline">
                View all →
              </Link>
            </div>
            
            {payments.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground">No payment history</p>
            ) : (
              <div className="space-y-3">
                {payments.slice(0, 5).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border/50"
                  >
                    <div>
                      <p className="font-medium">
                        {format(new Date(payment.due_date), 'MMMM yyyy')} Rent
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(payment.due_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${payment.amount_due.toLocaleString()}</p>
                      <p className={cn(
                        "text-xs",
                        payment.status === 'paid' ? "text-green-500" :
                        payment.status === 'late' ? "text-red-500" :
                        "text-yellow-500"
                      )}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/tenant/maintenance">
                <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Submit Maintenance Request
                </button>
              </Link>
              {nextPaymentDue && (
                <Link href="/tenant/payments">
                  <button className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors">
                    Pay Rent
                  </button>
                </Link>
              )}
              <Link href="/tenant/documents">
                <button className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors">
                  View Documents
                </button>
              </Link>
            </div>
          </div>

          {/* Active Maintenance Requests */}
          {activeMaintenanceRequests > 0 && (
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Active Maintenance</h3>
              <div className="space-y-3">
                {maintenanceRequests
                  .filter(r => ['open', 'assigned', 'in_progress'].includes(r.status || ''))
                  .slice(0, 3)
                  .map(request => (
                    <div key={request.id} className="text-sm">
                      <p className="font-medium line-clamp-1">{request.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "text-xs px-2 py-1 rounded",
                          request.status === 'open' ? "bg-yellow-500/20 text-yellow-600" :
                          request.status === 'in_progress' ? "bg-blue-500/20 text-blue-600" :
                          "bg-gray-500/20 text-gray-600"
                        )}>
                          {request.status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
              <Link href="/tenant/maintenance" className="block mt-4">
                <p className="text-sm text-primary hover:underline">View all requests →</p>
              </Link>
            </div>
          )}

          {/* Alerts */}
          {(overduePayments > 0 || (hasLease && daysUntilLeaseEnd < 90)) && (
            <div className="bg-card border border-orange-500/50 rounded-lg p-6">
              <h3 className="font-semibold mb-4 text-orange-400">Important Notices</h3>
              <div className="space-y-3">
                {overduePayments > 0 && (
                  <Link href="/tenant/payments" className="block">
                    <div className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span>{overduePayments} overdue {overduePayments === 1 ? 'payment' : 'payments'}</span>
                    </div>
                  </Link>
                )}
                {hasLease && daysUntilLeaseEnd < 90 && daysUntilLeaseEnd > 0 && (
                  <Link href="/tenant/my-lease" className="block">
                    <div className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <Clock className="h-4 w-4 text-orange-400" />
                      <span>Lease expires in {daysUntilLeaseEnd} days</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}