'use client';

import { useEffect } from 'react';
import {
  Building2, DollarSign, Wrench, Users,
  TrendingUp, Clock, AlertCircle, CheckCircle,
  ArrowRight, Calendar, Zap, Home, ChevronRight,
  Activity, Shield, Star
} from 'lucide-react';
import { formatDistanceToNow, format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import useLandlordStore from '@/lib/store/landlord';
import useAuthStore from '@/lib/store/auth';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/client';

function OccupancyRing({ rate }: { rate: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const filled = (rate / 100) * circumference;
  const color =
    rate >= 90 ? '#22c55e' : rate >= 75 ? '#3b82f6' : rate >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8"
        />
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none">{rate}%</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">occupied</span>
      </div>
    </div>
  );
}

function CollectionBar({ collected, total }: { collected: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Collected (all time)</span>
        <span className="font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-emerald-400 font-medium">${collected.toLocaleString()}</span>
        <span className="text-muted-foreground">of ${total.toLocaleString()}</span>
      </div>
    </div>
  );
}

function HealthScore({ score }: { score: number }) {
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work';
  const color =
    score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-blue-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';
  const bars = 5;
  const filled = Math.round((score / 100) * bars);

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-0.5">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-5 w-1.5 rounded-full transition-all',
              i < filled ? 'bg-current opacity-100' : 'bg-current opacity-15'
            )}
          />
        ))}
      </div>
      <div className={cn('text-sm font-semibold', color)}>{label}</div>
    </div>
  );
}

export default function LandlordDashboard() {
  const { user, setUser } = useAuthStore();
  const {
    units,
    tenants,
    leases,
    payments,
    maintenanceRequests,
    contractors,
    loading,
    fetchLandlordData
  } = useLandlordStore();

  useEffect(() => {
    if (!user) {
      getCurrentUser().then((currentUser) => {
        if (currentUser) setUser(currentUser);
      });
    }
  }, [user, setUser]);

  useEffect(() => {
    if (user?.entityId) {
      fetchLandlordData(user.entityId);
    }
  }, [user?.entityId, fetchLandlordData]);

  // Metrics
  const totalUnits = units.length;
  const activeLeases = leases.filter(
    (l) => new Date(l.end_date) > new Date() && l.status === 'active'
  );
  const occupiedUnits = activeLeases.length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const totalMonthlyRent = leases
    .filter((l) => l.status === 'active')
    .reduce((sum, l) => sum + (l.monthly_rent || 0), 0);

  const now = new Date();

  const activeMaintenanceRequests = maintenanceRequests.filter((r) =>
    ['open', 'assigned', 'in_progress'].includes(r.status || '')
  ).length;

  const overduePayments = payments.filter(
    (p) =>
      p.status === 'late' ||
      (p.status === 'pending' && new Date(p.due_date) < now)
  ).length;

  const totalExpected = payments.reduce((sum, p) => sum + (p.amount_due || 0), 0);
  const totalCollected = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const collectionRate = totalExpected > 0
    ? Math.round((totalCollected / totalExpected) * 100)
    : 0;

  // Portfolio health: composite of occupancy, collection rate, maintenance health
  const maintenanceHealth = activeMaintenanceRequests === 0 ? 100 : Math.max(0, 100 - activeMaintenanceRequests * 6);
  const healthScore = Math.round((occupancyRate * 0.4) + (collectionRate * 0.4) + (maintenanceHealth * 0.2));

  // Leases expiring within 60 days
  const expiringLeases = leases
    .filter((l) => {
      const daysLeft = differenceInDays(new Date(l.end_date), now);
      return l.status === 'active' && daysLeft >= 0 && daysLeft <= 60;
    })
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
    .slice(0, 3);

  // Upcoming payments due in next 7 days
  const upcomingPayments = payments
    .filter((p) => {
      const daysLeft = differenceInDays(new Date(p.due_date), now);
      return p.status === 'pending' && daysLeft >= 0 && daysLeft <= 7;
    })
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 3);

  // Recent activities
  const recentActivities = [
    ...maintenanceRequests.slice(0, 4).map((r) => ({
      id: r.id,
      type: 'maintenance' as const,
      description: r.description,
      time: r.created_at,
      status: r.status,
      priority: r.priority
    })),
    ...payments.slice(0, 4).map((p) => ({
      id: p.id,
      type: 'payment' as const,
      description: `Payment of $${p.amount_due?.toLocaleString()}`,
      time: p.paid_date || p.due_date,
      status: p.status,
      priority: undefined
    }))
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  const firstName = user?.entity?.full_name?.split(' ')[0] || '';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

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

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-[oklch(0.18_0.04_240)] via-[oklch(0.16_0.02_250)] to-[oklch(0.13_0.01_260)] p-6 md:p-8">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-48 h-48 w-48 rounded-full bg-emerald-500/8 blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-0 justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{greeting}{firstName ? ',' : ''}</p>
            <h1 className="text-3xl font-bold tracking-tight">
              {firstName ? firstName : 'Your Portfolio'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {format(now, 'EEEE, MMMM d')} · {totalUnits} {totalUnits === 1 ? 'property' : 'properties'} under management
            </p>
          </div>

          {/* Health score */}
          <div className="flex items-center gap-6">
            <div className="hidden md:block h-14 w-px bg-white/10" />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Portfolio Health</p>
              <HealthScore score={healthScore} />
              <p className="text-xs text-muted-foreground">{healthScore}/100 composite score</p>
            </div>
            <div className="hidden md:block h-14 w-px bg-white/10" />
            <OccupancyRing rate={occupancyRate} />
          </div>
        </div>

        {/* Alert strip */}
        {(overduePayments > 0 || activeMaintenanceRequests > 0) && (
          <div className="relative mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-2.5 text-sm">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span className="text-red-400 font-medium">Needs attention:</span>
            {overduePayments > 0 && (
              <Link
                href="/landlord/payments"
                className="flex items-center gap-1 text-red-300 hover:text-red-200 underline underline-offset-2 transition-colors"
              >
                {overduePayments} overdue payment{overduePayments > 1 ? 's' : ''}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            {overduePayments > 0 && activeMaintenanceRequests > 0 && (
              <span className="text-red-500">·</span>
            )}
            {activeMaintenanceRequests > 0 && (
              <Link
                href="/landlord/maintenance"
                className="flex items-center gap-1 text-red-300 hover:text-red-200 underline underline-offset-2 transition-colors"
              >
                {activeMaintenanceRequests} open maintenance request{activeMaintenanceRequests > 1 ? 's' : ''}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Primary KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="col-span-2 lg:col-span-1 group relative overflow-hidden rounded-xl border border-white/8 bg-card p-5 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Monthly Revenue</p>
              <p className="text-3xl font-bold tracking-tight text-primary">
                ${totalMonthlyRent.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-4">
            <CollectionBar collected={totalCollected} total={totalExpected} />
          </div>
        </div>

        {/* Units */}
        <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-card p-5 hover:border-blue-500/30 transition-all hover:shadow-lg hover:shadow-blue-500/5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Properties</p>
            <div className="rounded-xl bg-blue-500/10 p-2.5">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight">{totalUnits}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {occupiedUnits} occupied
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
              {totalUnits - occupiedUnits} vacant
            </span>
          </div>
        </div>

        {/* Tenants */}
        <div className="group relative overflow-hidden rounded-xl border border-white/8 bg-card p-5 hover:border-violet-500/30 transition-all hover:shadow-lg hover:shadow-violet-500/5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Tenants</p>
            <div className="rounded-xl bg-violet-500/10 p-2.5">
              <Users className="h-5 w-5 text-violet-400" />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight">{tenants.length}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            {leases.filter((l) => l.status === 'active').length} active leases
          </div>
        </div>

        {/* Maintenance */}
        <div className={cn(
          "group relative overflow-hidden rounded-xl border border-white/8 bg-card p-5 transition-all hover:shadow-lg",
          activeMaintenanceRequests > 5
            ? "border-orange-500/30 hover:border-orange-500/50 hover:shadow-orange-500/5"
            : "hover:border-slate-500/30 hover:shadow-slate-500/5"
        )}>
          <div className={cn(
            "pointer-events-none absolute inset-0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity",
            activeMaintenanceRequests > 5
              ? "bg-gradient-to-br from-orange-500/5"
              : "bg-gradient-to-br from-slate-500/5"
          )} />
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Maintenance</p>
            <div className={cn(
              "rounded-xl p-2.5",
              activeMaintenanceRequests > 5 ? "bg-orange-500/10" : "bg-slate-500/10"
            )}>
              <Wrench className={cn(
                "h-5 w-5",
                activeMaintenanceRequests > 5 ? "text-orange-400" : "text-slate-400"
              )} />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight">{activeMaintenanceRequests}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            open requests · {contractors.filter((c) => c.is_available).length} contractors ready
          </div>
        </div>
      </div>

      {/* ── Middle Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Activity — 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-white/8 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Recent Activity</h2>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/landlord/maintenance"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Maintenance <ChevronRight className="h-3 w-3" />
              </Link>
              <Link
                href="/landlord/payments"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Payments <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {recentActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Clock className="h-10 w-10 opacity-30" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentActivities.map((activity, idx) => {
                const isMaintenance = activity.type === 'maintenance';
                const statusColors: Record<string, string> = {
                  paid: 'text-emerald-400 bg-emerald-400/10',
                  completed: 'text-emerald-400 bg-emerald-400/10',
                  open: 'text-amber-400 bg-amber-400/10',
                  pending: 'text-amber-400 bg-amber-400/10',
                  in_progress: 'text-blue-400 bg-blue-400/10',
                  assigned: 'text-blue-400 bg-blue-400/10',
                  late: 'text-red-400 bg-red-400/10',
                };
                const statusClass = statusColors[activity.status || ''] || 'text-muted-foreground bg-white/5';

                return (
                  <Link
                    key={activity.id}
                    href={isMaintenance ? '/landlord/maintenance' : '/landlord/payments'}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    {/* Timeline dot */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center",
                        isMaintenance ? "bg-blue-500/10" : "bg-emerald-500/10"
                      )}>
                        {isMaintenance ? (
                          <Wrench className="h-4 w-4 text-blue-400" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                      {idx < recentActivities.length - 1 && (
                        <div className="absolute left-1/2 top-full h-full w-px -translate-x-1/2 bg-white/5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight line-clamp-1">
                        {activity.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                      </p>
                    </div>

                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0",
                      statusClass
                    )}>
                      {activity.status}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">

          {/* Quick Actions */}
          <div className="rounded-xl border border-white/8 bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <Link href="/landlord/properties/new">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all font-medium text-sm group">
                  <Home className="h-4 w-4" />
                  Add New Property
                  <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              </Link>
              <Link href="/landlord/leases">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 rounded-lg transition-all text-sm group">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  Create Lease
                  <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all" />
                </button>
              </Link>
              <Link href="/landlord/tenants">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 rounded-lg transition-all text-sm group">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Invite Tenant
                  <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all" />
                </button>
              </Link>
              <Link href="/landlord/maintenance">
                <button className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 rounded-lg transition-all text-sm group">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  View Maintenance
                  <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5 transition-all" />
                </button>
              </Link>
            </div>
          </div>

          {/* Stats pills */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/8 bg-card p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{collectionRate}%</p>
              <p className="text-[11px] text-muted-foreground mt-1">Collection Rate</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-card p-4 text-center">
              <p className={cn("text-2xl font-bold", overduePayments > 0 ? "text-red-400" : "text-emerald-400")}>
                {overduePayments}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Overdue Payments</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Upcoming Events ── */}
      {(expiringLeases.length > 0 || upcomingPayments.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Expiring Leases */}
          {expiringLeases.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8 bg-amber-500/5">
                <Calendar className="h-4 w-4 text-amber-400" />
                <h3 className="font-semibold text-sm">Leases Expiring Soon</h3>
                <span className="ml-auto text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">
                  {expiringLeases.length}
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {expiringLeases.map((lease) => {
                  const daysLeft = differenceInDays(new Date(lease.end_date), now);
                  return (
                    <Link key={lease.id} href="/landlord/leases">
                      <div className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                          <Shield className="h-4 w-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {lease.unit_id ? `Unit #${String(lease.unit_id).slice(0, 6)}` : 'Lease'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(lease.end_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <span className={cn(
                          "text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0",
                          daysLeft <= 14
                            ? "bg-red-400/10 text-red-400"
                            : "bg-amber-400/10 text-amber-400"
                        )}>
                          {daysLeft}d left
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Payments */}
          {upcomingPayments.length > 0 && (
            <div className="rounded-xl border border-blue-500/20 bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8 bg-blue-500/5">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <h3 className="font-semibold text-sm">Payments Due This Week</h3>
                <span className="ml-auto text-xs bg-blue-400/10 text-blue-400 px-2 py-0.5 rounded-full">
                  {upcomingPayments.length}
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {upcomingPayments.map((payment) => {
                  const daysLeft = differenceInDays(new Date(payment.due_date), now);
                  return (
                    <Link key={payment.id} href="/landlord/payments">
                      <div className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <Star className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            ${payment.amount_due?.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Due {format(new Date(payment.due_date), 'MMM d')}
                          </p>
                        </div>
                        <span className={cn(
                          "text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0",
                          daysLeft === 0
                            ? "bg-red-400/10 text-red-400"
                            : "bg-blue-400/10 text-blue-400"
                        )}>
                          {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
