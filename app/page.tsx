'use client';

import { Building2, DollarSign, Wrench, AlertCircle, Brain } from "lucide-react";
import KPICard from "@/components/dashboard/KPICard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import AgentStatusPanel from "@/components/layout/AgentStatusPanel";
import useStore from "@/lib/store/useStore";
import Link from "next/link";

export default function DashboardPage() {
  const { 
    tenants, 
    tickets, 
    rentPayments, 
    activityFeed,
    loading
  } = useStore();

  // Calculate KPI values
  const totalUnits = tenants.length;
  const openTickets = tickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length;
  const latePayments = rentPayments.filter(p => p.status === 'late').length;
  
  const rentCollected = rentPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const rentExpected = rentPayments
    .reduce((sum, p) => sum + p.amount, 0);
  
  const aiResolvedTickets = tickets.filter(t => t.aiClassified && t.status === 'completed').length;
  const totalTickets = tickets.length;
  const aiResolutionRate = totalTickets > 0 ? Math.round((aiResolvedTickets / totalTickets) * 100) : 0;

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
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Property management command center</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Units"
          value={totalUnits}
          icon={Building2}
          description="Managed properties"
        />
        
        <KPICard
          title="Rent Collected"
          value={`$${rentCollected.toLocaleString()}`}
          icon={DollarSign}
          description={`of $${rentExpected.toLocaleString()}`}
        />
        
        <KPICard
          title="Open Tickets"
          value={openTickets}
          icon={Wrench}
          description="Maintenance requests"
        />
        
        <KPICard
          title="Late Payments"
          value={latePayments}
          icon={AlertCircle}
          description="Overdue rent"
          className={latePayments > 0 ? "border-destructive/50" : ""}
        />
        
        <KPICard
          title="AI Resolution"
          value={`${aiResolutionRate}%`}
          icon={Brain}
          description="Tickets resolved by AI"
          highlight={true}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed - Takes 2 columns */}
        <div className="lg:col-span-2">
          <ActivityFeed activities={activityFeed} />
        </div>
        
        {/* Agent Status Panel - Takes 1 column */}
        <div>
          <AgentStatusPanel />
          
          {/* Quick Actions */}
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <Link href="/maintenance">
              <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors ai-glow">
                Create Maintenance Ticket
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}