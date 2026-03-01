'use client';

import { useEffect } from 'react';
import { 
  Home, DollarSign, Wrench, FileText, 
  Calendar, Clock, AlertCircle, ArrowRight,
  TrendingUp, CheckCircle2, CircleDot, Zap,
  ChevronRight, CreditCard, Bell
} from 'lucide-react';
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

  useEffect(() => {
    async function loadUserData() {
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

  const hasLease = !!tenantInfo?.leases;
  const daysUntilLeaseEnd = hasLease
    ? Math.floor((new Date(tenantInfo.leases.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const leaseDurationDays = hasLease
    ? Math.floor((new Date(tenantInfo.leases.end_date).getTime() - new Date(tenantInfo.leases.start_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const leaseProgressPercent = hasLease && leaseDurationDays > 0
    ? Math.min(100, Math.max(0, Math.round(((leaseDurationDays - daysUntilLeaseEnd) / leaseDurationDays) * 100)))
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!tenantInfo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Home className="h-8 w-8 text-primary" />
          </div>
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

  const firstName = tenantInfo.full_name?.split(' ')[0] || 'Tenant';

  return (
    <div className="min-h-full bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-blue-500/5 pointer-events-none" />
        <div className="relative px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Good {getTimeOfDay()}</p>
              <h1 className="text-3xl font-bold tracking-tight mb-2">{firstName}</h1>
              {hasLease && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>{tenantInfo.leases?.units?.address}</span>
                </div>
              )}
            </div>

            {/* Alert badge */}
            {(overduePayments > 0 || (hasLease && daysUntilLeaseEnd < 90)) && (
              <Link href="/tenant/payments">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer">
                  <Bell className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    {overduePayments > 0 ? `${overduePayments} overdue` : 'Lease ending soon'}
                  </span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stat Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Next Payment */}
          <div className={cn(
            "relative rounded-2xl p-5 border overflow-hidden group hover:shadow-lg transition-all duration-200",
            overduePayments > 0
              ? "bg-red-950/20 border-red-500/30"
              : "bg-card border-border/60"
          )}>
            <div className="absolute top-0 right-0 h-24 w-24 rounded-bl-full bg-primary/5 -mr-6 -mt-6 group-hover:bg-primary/8 transition-colors" />
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center",
                overduePayments > 0 ? "bg-red-500/20" : "bg-primary/10"
              )}>
                <Calendar className={cn("h-4 w-4", overduePayments > 0 ? "text-red-400" : "text-primary")} />
              </div>
              {overduePayments > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Overdue</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">Next Payment</p>
            <p className="text-2xl font-bold tracking-tight mb-1">
              {nextPaymentDue 
                ? format(new Date(nextPaymentDue.due_date), 'MMM d')
                : '—'
              }
            </p>
            <p className="text-xs text-muted-foreground">
              {nextPaymentDue 
                ? `$${nextPaymentDue.amount_due.toLocaleString()} due`
                : 'All clear'
              }
            </p>
          </div>

          {/* Monthly Rent */}
          <div className="relative rounded-2xl p-5 border border-border/60 bg-card overflow-hidden group hover:shadow-lg transition-all duration-200">
            <div className="absolute top-0 right-0 h-24 w-24 rounded-bl-full bg-green-500/5 -mr-6 -mt-6 group-hover:bg-green-500/8 transition-colors" />
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-green-500/10">
                <DollarSign className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Monthly Rent</p>
            <p className="text-2xl font-bold tracking-tight mb-1">
              {hasLease ? `$${tenantInfo.leases?.rent_amount?.toLocaleString() || '0'}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              ${totalPaidThisYear.toLocaleString()} paid this year
            </p>
          </div>

          {/* Maintenance */}
          <div className={cn(
            "relative rounded-2xl p-5 border overflow-hidden group hover:shadow-lg transition-all duration-200",
            activeMaintenanceRequests > 0
              ? "bg-blue-950/20 border-blue-500/30"
              : "bg-card border-border/60"
          )}>
            <div className="absolute top-0 right-0 h-24 w-24 rounded-bl-full bg-blue-500/5 -mr-6 -mt-6 group-hover:bg-blue-500/8 transition-colors" />
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center",
                activeMaintenanceRequests > 0 ? "bg-blue-500/20" : "bg-secondary"
              )}>
                <Wrench className={cn("h-4 w-4", activeMaintenanceRequests > 0 ? "text-blue-400" : "text-muted-foreground")} />
              </div>
              {activeMaintenanceRequests > 0 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{activeMaintenanceRequests} active</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">Maintenance</p>
            <p className="text-2xl font-bold tracking-tight mb-1">{activeMaintenanceRequests}</p>
            <p className="text-xs text-muted-foreground">{completedRequests} resolved</p>
          </div>

          {/* Lease Status */}
          <div className={cn(
            "relative rounded-2xl p-5 border overflow-hidden group hover:shadow-lg transition-all duration-200",
            hasLease && daysUntilLeaseEnd < 90
              ? "bg-orange-950/20 border-orange-500/30"
              : "bg-card border-border/60"
          )}>
            <div className="absolute top-0 right-0 h-24 w-24 rounded-bl-full bg-purple-500/5 -mr-6 -mt-6 group-hover:bg-purple-500/8 transition-colors" />
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center",
                hasLease && daysUntilLeaseEnd < 90 ? "bg-orange-500/20" : "bg-purple-500/10"
              )}>
                <FileText className={cn("h-4 w-4", hasLease && daysUntilLeaseEnd < 90 ? "text-orange-400" : "text-purple-400")} />
              </div>
              {hasLease && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  daysUntilLeaseEnd > 90 
                    ? "bg-green-500/20 text-green-400"
                    : "bg-orange-500/20 text-orange-400"
                )}>
                  {daysUntilLeaseEnd > 90 ? 'Active' : 'Ending Soon'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-1">Lease</p>
            <p className="text-2xl font-bold tracking-tight mb-1">
              {hasLease ? `${daysUntilLeaseEnd}d` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasLease ? 'remaining' : 'No active lease'}
            </p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Lease + Payments */}
          <div className="lg:col-span-2 space-y-5">
            {/* Lease Card */}
            {hasLease && (
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="px-6 pt-5 pb-4">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-semibold text-base">Lease Overview</h2>
                    <Link href="/tenant/my-lease" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                      Details <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Property</p>
                      <p className="text-sm font-medium">{tenantInfo.leases?.units?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                      <p className="text-sm font-medium">{tenantInfo.leases?.units?.address || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Start Date</p>
                      <p className="text-sm font-medium">
                        {format(new Date(tenantInfo.leases!.start_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">End Date</p>
                      <p className="text-sm font-medium">
                        {format(new Date(tenantInfo.leases!.end_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Monthly Rent</p>
                      <p className="text-sm font-semibold text-green-400">
                        ${tenantInfo.leases?.rent_amount?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Security Deposit</p>
                      <p className="text-sm font-medium">
                        ${tenantInfo.leases?.security_deposit?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Lease progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-2">
                      <span>Lease Progress</span>
                      <span>{leaseProgressPercent}% complete</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          daysUntilLeaseEnd < 90 ? "bg-orange-500" : "bg-primary"
                        )}
                        style={{ width: `${leaseProgressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payments */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-base">Recent Payments</h2>
                </div>
                <Link href="/tenant/payments" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                  <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center mb-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No payment history</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {payments.slice(0, 5).map((payment, i) => {
                    const isPaid = payment.status === 'paid';
                    const isLate = payment.status === 'late';
                    const isPending = !isPaid && !isLate;
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between px-6 py-3.5 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0",
                            isPaid ? "bg-green-500/10" :
                            isLate ? "bg-red-500/10" :
                            "bg-yellow-500/10"
                          )}>
                            {isPaid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : isLate ? (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {format(new Date(payment.due_date), 'MMMM yyyy')} Rent
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Due {format(new Date(payment.due_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">${payment.amount_due.toLocaleString()}</p>
                          <p className={cn(
                            "text-xs font-medium",
                            isPaid ? "text-green-500" :
                            isLate ? "text-red-400" :
                            "text-yellow-500"
                          )}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Quick Actions */}
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Quick Actions</h3>
              </div>
              <div className="space-y-2.5">
                <Link href="/tenant/maintenance" className="block">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <Wrench className="h-4 w-4" />
                      <span className="text-sm font-medium">Submit Maintenance</span>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-70" />
                  </div>
                </Link>

                {nextPaymentDue && (
                  <Link href="/tenant/payments" className="block">
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <DollarSign className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium">Pay Rent</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                )}

                <Link href="/tenant/documents" className="block">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">View Documents</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>

                <Link href="/tenant/chat" className="block">
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Contact Manager</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              </div>
            </div>

            {/* Active Maintenance */}
            {activeMaintenanceRequests > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-blue-400" />
                    <h3 className="font-semibold text-sm">Active Maintenance</h3>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                    {activeMaintenanceRequests}
                  </span>
                </div>
                <div className="space-y-3">
                  {maintenanceRequests
                    .filter(r => ['open', 'assigned', 'in_progress'].includes(r.status || ''))
                    .slice(0, 3)
                    .map(request => (
                      <div key={request.id} className="flex items-start gap-3">
                        <div className={cn(
                          "mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0",
                          request.status === 'in_progress' ? "bg-blue-500/20" : "bg-yellow-500/20"
                        )}>
                          <CircleDot className={cn(
                            "h-3 w-3",
                            request.status === 'in_progress' ? "text-blue-400" : "text-yellow-500"
                          )} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium line-clamp-1">{request.description}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn(
                              "text-xs capitalize",
                              request.status === 'open' ? "text-yellow-500" :
                              request.status === 'in_progress' ? "text-blue-400" :
                              "text-muted-foreground"
                            )}>
                              {request.status?.replace('_', ' ')}
                            </span>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                <Link href="/tenant/maintenance" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-4">
                  View all requests <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Alerts */}
            {(overduePayments > 0 || (hasLease && daysUntilLeaseEnd < 90 && daysUntilLeaseEnd > 0)) && (
              <div className="rounded-2xl border border-orange-500/25 bg-orange-950/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="h-4 w-4 text-orange-400" />
                  <h3 className="font-semibold text-sm text-orange-400">Important Notices</h3>
                </div>
                <div className="space-y-3">
                  {overduePayments > 0 && (
                    <Link href="/tenant/payments" className="block">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 hover:bg-red-500/15 transition-colors">
                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-red-300">
                          {overduePayments} overdue {overduePayments === 1 ? 'payment' : 'payments'}
                        </span>
                      </div>
                    </Link>
                  )}
                  {hasLease && daysUntilLeaseEnd < 90 && daysUntilLeaseEnd > 0 && (
                    <Link href="/tenant/my-lease" className="block">
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/15 transition-colors">
                        <Clock className="h-4 w-4 text-orange-400 flex-shrink-0" />
                        <span className="text-sm text-orange-300">
                          Lease expires in {daysUntilLeaseEnd} days
                        </span>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
