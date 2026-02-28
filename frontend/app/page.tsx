'use client';

import { 
  Building2, DollarSign, Wrench, AlertCircle, Brain, 
  Scale, Users, MessageCircle, Shield, FileText,
  TrendingUp, Clock 
} from "lucide-react";
import KPICard from "@/components/dashboard/KPICard";
import AgentStatusPanel from "@/components/layout/AgentStatusPanel";
import useStore from "@/lib/store/useStore";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { 
    landlords,
    units,
    unitStatus,
    leases,
    tenants,
    maintenanceRequests,
    maintenanceIssues,
    payments,
    disputes,
    legalActions,
    unitDocuments,
    landlordNotifications,
    agentActions,
    loading
  } = useStore();

  // Calculate KPI values
  const totalLandlords = landlords.length;
  const totalUnits = units.length;
  const occupiedUnits = unitStatus.filter(s => s.occupancy_status === 'occupied').length;
  const vacantUnits = unitStatus.filter(s => s.occupancy_status === 'vacant').length;
  
  const activeMaintenanceRequests = maintenanceRequests.filter(r => 
    ['open', 'assigned', 'in_progress'].includes(r.status || '')
  ).length;
  
  const chronicIssues = maintenanceIssues.filter(i => i.is_chronic).length;
  const activeDisputes = disputes.filter(d => d.status !== 'closed' && d.status !== 'ruled').length;
  const legalActionsInProgress = legalActions.filter(la => la.status === 'issued').length;
  
  const certificatesExpiringSoon = unitDocuments.filter(doc => 
    doc.status === 'expiring_soon' || doc.status === 'expired'
  ).length;
  
  const unreadNotifications = landlordNotifications.filter(n => !n.read_at).length;
  
  // Calculate rent metrics
  const rentCollected = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  
  const rentExpected = payments
    .reduce((sum, p) => sum + p.amount_due, 0);
  
  const latePayments = payments.filter(p => p.status === 'late').length;
  
  // AI Metrics
  const aiResolvedRequests = maintenanceRequests.filter(r => 
    r.status === 'completed' && agentActions.some(a => 
      a.action_category === 'maintenance' && 
      a.confidence_score && a.confidence_score > 0.8
    )
  ).length;
  
  const aiResolutionRate = maintenanceRequests.length > 0 
    ? Math.round((aiResolvedRequests / maintenanceRequests.length) * 100) 
    : 0;

  // Get recent agent actions
  const recentAgentActions = agentActions.slice(0, 10);

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
        <h1 className="text-2xl font-bold">Property Management Dashboard</h1>
        <p className="text-muted-foreground">AI-powered command center for {totalLandlords} landlords</p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Units"
          value={totalUnits}
          icon={Building2}
          description={`${occupiedUnits} occupied, ${vacantUnits} vacant`}
        />
        
        <KPICard
          title="Rent Collected"
          value={`$${rentCollected.toLocaleString()}`}
          icon={DollarSign}
          description={`of $${rentExpected.toLocaleString()}`}
        />
        
        <KPICard
          title="Active Issues"
          value={activeMaintenanceRequests}
          icon={Wrench}
          description={`${chronicIssues} chronic problems`}
          className={chronicIssues > 0 ? "border-orange-500/50" : ""}
        />
        
        <KPICard
          title="AI Resolution"
          value={`${aiResolutionRate}%`}
          icon={Brain}
          description="Automated resolutions"
          highlight={true}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Scale className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{activeDisputes}</p>
          <p className="text-xs text-muted-foreground">Active Disputes</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <FileText className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{legalActionsInProgress}</p>
          <p className="text-xs text-muted-foreground">Legal Notices</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{latePayments}</p>
          <p className="text-xs text-muted-foreground">Late Payments</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Shield className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{certificatesExpiringSoon}</p>
          <p className="text-xs text-muted-foreground">Certs Expiring</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <MessageCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{tenants.length}</p>
          <p className="text-xs text-muted-foreground">Active Tenants</p>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <Users className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xl font-semibold">{unreadNotifications}</p>
          <p className="text-xs text-muted-foreground">Unread Alerts</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Actions Log - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">AI Agent Actions</h2>
              <Brain className="h-5 w-5 text-primary pulse-glow" />
            </div>
            
            {recentAgentActions.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No agent actions yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  The AI agent will log its actions here
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentAgentActions.map((action) => {
                  const confidence = action.confidence_score ? Math.round(action.confidence_score * 100) : 0;
                  return (
                    <div
                      key={action.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 border border-border/50"
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        action.action_category === 'maintenance' && "bg-blue-500/20",
                        action.action_category === 'payment' && "bg-green-500/20",
                        action.action_category === 'legal' && "bg-red-500/20",
                        action.action_category === 'communication' && "bg-purple-500/20",
                        !['maintenance', 'payment', 'legal', 'communication'].includes(action.action_category) && "bg-gray-500/20"
                      )}>
                        {action.action_category === 'maintenance' && <Wrench className="h-4 w-4 text-blue-400" />}
                        {action.action_category === 'payment' && <DollarSign className="h-4 w-4 text-green-400" />}
                        {action.action_category === 'legal' && <Scale className="h-4 w-4 text-red-400" />}
                        {action.action_category === 'communication' && <MessageCircle className="h-4 w-4 text-purple-400" />}
                        {!['maintenance', 'payment', 'legal', 'communication'].includes(action.action_category) && 
                          <Brain className="h-4 w-4 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium mb-1">
                          {action.action_description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(action.timestamp || ''), { addSuffix: true })}
                          </span>
                          {confidence > 0 && (
                            <span className={cn(
                              "flex items-center gap-1",
                              confidence >= 80 ? "text-green-400" :
                              confidence >= 60 ? "text-yellow-400" :
                              "text-red-400"
                            )}>
                              <TrendingUp className="h-3 w-3" />
                              {confidence}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/agent-logs" className="text-sm text-primary hover:underline">
                View all agent actions →
              </Link>
            </div>
          </div>
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* Agent Status Panel */}
          <AgentStatusPanel />
          
          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/maintenance">
                <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors ai-glow">
                  Create Maintenance Request
                </button>
              </Link>
              <Link href="/legal">
                <button className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors">
                  Record Dispute
                </button>
              </Link>
              <Link href="/conversations">
                <button className="w-full px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors">
                  View WhatsApp Messages
                </button>
              </Link>
            </div>
          </div>
          
          {/* Critical Alerts */}
          {(certificatesExpiringSoon > 0 || chronicIssues > 0 || unreadNotifications > 0) && (
            <div className="bg-card border border-red-500/50 rounded-lg p-6">
              <h3 className="font-semibold mb-4 text-red-400">Critical Alerts</h3>
              <div className="space-y-3">
                {certificatesExpiringSoon > 0 && (
                  <Link href="/units" className="block">
                    <div className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <Shield className="h-4 w-4 text-red-400" />
                      <span>{certificatesExpiringSoon} certificates expiring soon</span>
                    </div>
                  </Link>
                )}
                {chronicIssues > 0 && (
                  <Link href="/maintenance" className="block">
                    <div className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <AlertCircle className="h-4 w-4 text-orange-400" />
                      <span>{chronicIssues} chronic maintenance issues</span>
                    </div>
                  </Link>
                )}
                {unreadNotifications > 0 && (
                  <Link href="/landlords" className="block">
                    <div className="flex items-center gap-2 text-sm hover:text-primary transition-colors">
                      <Users className="h-4 w-4 text-yellow-400" />
                      <span>{unreadNotifications} unread landlord notifications</span>
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