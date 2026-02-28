'use client';

import { useEffect } from 'react';
import { 
  Building2, DollarSign, Wrench, Users, 
  TrendingUp, Clock, AlertCircle, CheckCircle 
} from 'lucide-react';
import KPICard from '@/components/dashboard/KPICard';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import useLandlordStore from '@/lib/store/landlord';
import useAuthStore from '@/lib/store/auth';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/client';

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

  // Fetch authenticated user and their data
  useEffect(() => {
    async function loadUserData() {
      if (!user) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      }
      
      if (user?.entityId) {
        fetchLandlordData(user.entityId);
      }
    }
    
    loadUserData();
  }, [user, setUser, fetchLandlordData]);

  // Calculate metrics
  const totalUnits = units.length;
  const occupiedUnits = leases.filter(l => 
    new Date(l.end_date) > new Date() && l.status === 'active'
  ).length;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const totalMonthlyRent = leases
    .filter(l => l.status === 'active')
    .reduce((sum, l) => sum + l.rent_amount, 0);

  const collectedThisMonth = payments
    .filter(p => {
      const paymentDate = new Date(p.payment_date || '');
      const now = new Date();
      return p.status === 'paid' && 
        paymentDate.getMonth() === now.getMonth() &&
        paymentDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  const activeMaintenanceRequests = maintenanceRequests.filter(r => 
    ['open', 'assigned', 'in_progress'].includes(r.status || '')
  ).length;

  const overduePayments = payments.filter(p => 
    p.status === 'late' || 
    (p.status === 'pending' && new Date(p.due_date) < new Date())
  ).length;

  // Recent activities
  const recentActivities = [
    ...maintenanceRequests.slice(0, 3).map(r => ({
      id: r.id,
      type: 'maintenance' as const,
      description: r.description,
      time: r.created_at,
      status: r.status
    })),
    ...payments.slice(0, 3).map(p => ({
      id: p.id,
      type: 'payment' as const,
      description: `Payment of $${p.amount_due}`,
      time: p.payment_date || p.due_date,
      status: p.status
    }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

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
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{user?.entity?.full_name ? `, ${user.entity.full_name}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your {totalUnits} {totalUnits === 1 ? 'property' : 'properties'}
        </p>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Properties"
          value={totalUnits}
          icon={Building2}
          description={`${occupiedUnits} occupied, ${totalUnits - occupiedUnits} vacant`}
        />
        
        <KPICard
          title="Occupancy Rate"
          value={`${occupancyRate}%`}
          icon={Users}
          description={`${tenants.length} active tenants`}
          className={occupancyRate < 80 ? "border-orange-500/50" : ""}
        />
        
        <KPICard
          title="Monthly Revenue"
          value={`$${totalMonthlyRent.toLocaleString()}`}
          icon={DollarSign}
          description={`$${collectedThisMonth.toLocaleString()} collected`}
          highlight={true}
        />
        
        <KPICard
          title="Maintenance"
          value={activeMaintenanceRequests}
          icon={Wrench}
          description={`${contractors.length} contractors`}
          className={activeMaintenanceRequests > 5 ? "border-red-500/50" : ""}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{overduePayments}</p>
          <p className="text-xs text-muted-foreground">Overdue Payments</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <CheckCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{leases.filter(l => l.status === 'active').length}</p>
          <p className="text-xs text-muted-foreground">Active Leases</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Users className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{contractors.filter(c => c.is_available).length}</p>
          <p className="text-xs text-muted-foreground">Available Contractors</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">
            {payments.length > 0 
              ? `${Math.round((payments.filter(p => p.status === 'paid').length / payments.length) * 100)}%`
              : 'N/A'
            }
          </p>
          <p className="text-xs text-muted-foreground">Collection Rate</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            
            {recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 border border-border/50"
                  >
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                      activity.type === 'maintenance' ? "bg-blue-500/20" : "bg-green-500/20"
                    )}>
                      {activity.type === 'maintenance' ? (
                        <Wrench className="h-4 w-4 text-blue-400" />
                      ) : (
                        <DollarSign className="h-4 w-4 text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-1 line-clamp-2">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                        </span>
                        <span className={cn(
                          "capitalize",
                          activity.status === 'paid' || activity.status === 'completed' ? "text-green-400" :
                          activity.status === 'open' || activity.status === 'pending' ? "text-yellow-400" :
                          "text-muted-foreground"
                        )}>
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/landlord/maintenance" className="text-sm text-primary hover:underline">
                View all activity →
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/landlord/properties">
                <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                  Add New Property
                </button>
              </Link>
              <Link href="/landlord/leases">
                <button className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors">
                  Create Lease
                </button>
              </Link>
              <Link href="/landlord/tenants">
                <button className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors">
                  Invite Tenant
                </button>
              </Link>
            </div>
          </div>

          {/* Alerts */}
          {(overduePayments > 0 || activeMaintenanceRequests > 5) && (
            <div className="bg-card border border-red-500/50 rounded-lg p-6">
              <h3 className="font-semibold mb-4 text-red-400">Needs Attention</h3>
              <div className="space-y-3">
                {overduePayments > 0 && (
                  <Link href="/landlord/payments" className="block">
                    <div className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span>{overduePayments} overdue payments</span>
                    </div>
                  </Link>
                )}
                {activeMaintenanceRequests > 5 && (
                  <Link href="/landlord/maintenance" className="block">
                    <div className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <Wrench className="h-4 w-4 text-orange-400" />
                      <span>{activeMaintenanceRequests} pending maintenance requests</span>
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