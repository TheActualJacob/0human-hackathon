'use client';

import { useState, useEffect } from "react";
import {
  DollarSign, Send, AlertCircle, CheckCircle,
  Calendar, TrendingUp, FileText, Plus, Clock,
  Home, User, CreditCard, BarChart2, AlertTriangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useLandlordStore from "@/lib/store/landlord";
import useStore from "@/lib/store/useStore";
import useAuthStore from "@/lib/store/auth";
import { getCurrentUser } from "@/lib/auth/client";
import { getMonthlyReport, type MonthlyReportResponse } from "@/lib/api/payments";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function LandlordPaymentsPage() {
  const { 
    payments, 
    leases,
    tenants,
    units,
    loading,
    fetchLandlordData
  } = useLandlordStore();

  const {
    paymentPlans,
    updatePayment,
    addPaymentPlan,
    addLandlordNotification,
    logAgentAction
  } = useStore();
  
  const { user } = useAuthStore();

  const [autonomousMode, setAutonomousMode] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reportData, setReportData] = useState<MonthlyReportResponse | null>(null);

  useEffect(() => {
    async function load() {
      let currentUser = user;
      if (!currentUser) {
        currentUser = await getCurrentUser();
        if (currentUser) useAuthStore.getState().setUser(currentUser);
      }
      if (currentUser?.entityId) {
        fetchLandlordData(currentUser.entityId);
        try {
          const report = await getMonthlyReport(currentUser.entityId);
          setReportData(report);
        } catch {
          // report is optional — silently skip if unavailable
        }
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get payment with details
  const getPaymentWithDetails = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return null;
    
    const lease = leases.find(l => l.id === payment.lease_id);
    if (!lease) return null;
    
    const tenant = tenants.find(t => t.lease_id === lease.id && t.is_primary_tenant !== false)
      ?? tenants.find(t => t.lease_id === lease.id);
    const unit = units.find(u => u.id === lease.unit_id);
    const plan = paymentPlans.find(pp => pp.lease_id === lease.id && pp.status === 'active');
    
    return { payment, lease, tenant, unit, plan };
  };

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    if (filterStatus === 'all') return true;
    return payment.status === filterStatus;
  });

  // Monthly expected income from current leases (active or pending — exclude only expired/terminated)
  const activeLeases = leases.filter(
    l => l.status !== 'expired' && l.status !== 'terminated' && l.status !== 'notice_given'
  );
  const monthlyExpected = activeLeases.reduce((sum, l) => sum + (l.monthly_rent || 0), 0);

  // Current month slice for meaningful collection rate
  const currentYearMonth = format(new Date(), 'yyyy-MM');
  const thisMonthPayments = payments.filter(p => p.due_date?.startsWith(currentYearMonth));
  const thisMonthCollected = thisMonthPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  // Pending and overdue across all time
  const totalCollected = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount_due, 0);
  const totalLate = payments
    .filter(p => p.status === 'late')
    .reduce((sum, p) => sum + p.amount_due, 0);

  const collectionRate = monthlyExpected > 0
    ? Math.round((thisMonthCollected / monthlyExpected) * 100)
    : 0;

  // Count payment plans for landlord's tenants
  const landlordPaymentPlans = paymentPlans.filter(pp => {
    const lease = leases.find(l => l.id === pp.lease_id);
    return lease && pp.status === 'active';
  });
  
  const activePlans = landlordPaymentPlans.length;
  const totalArrears = landlordPaymentPlans
    .reduce((sum, pp) => sum + pp.total_arrears, 0);

  const handleSendReminder = async (paymentId: string) => {
    const details = getPaymentWithDetails(paymentId);
    if (!details?.payment || !details.tenant) return;

    // Update payment to show reminder sent
    await updatePayment(paymentId, { status: 'late' });
    
    // Log AI action
    await logAgentAction({
      lease_id: details.lease.id,
      action_category: 'payment',
      action_description: `Sent payment reminder to ${details.tenant.full_name} for €${details.payment.amount_due}`,
      confidence_score: 0.95
    });

    // Notify landlord
    await addLandlordNotification({
      landlord_id: details.unit?.landlord_id || '',
      lease_id: details.lease.id,
      notification_type: 'rent_overdue',
      message: `Payment reminder sent to ${details.tenant.full_name} (${details.unit?.unit_identifier}) for overdue rent of €${details.payment.amount_due}`
    });
  };

  const handleCreatePaymentPlan = async (leaseId: string, arrears: number) => {
    const installmentAmount = Math.round(arrears / 6); // 6 month plan
    
    await addPaymentPlan({
      lease_id: leaseId,
      total_arrears: arrears,
      installment_amount: installmentAmount,
      installment_frequency: 'monthly',
      start_date: new Date().toISOString().split('T')[0]
    });

    await logAgentAction({
      lease_id: leaseId,
      action_category: 'payment',
      action_description: `Created payment plan: €${installmentAmount}/month for €${arrears} total arrears`,
      confidence_score: 0.9
    });

    setShowPaymentPlanDialog(false);
  };

  const columns = [
    {
      key: 'tenant',
      header: 'Tenant / Unit',
      accessor: (payment: any) => {
        const details = getPaymentWithDetails(payment.id);
        return (
          <div>
            <p className="font-medium">{details?.tenant?.full_name || 'Unknown'}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Home className="h-3 w-3" />
              {details?.unit?.unit_identifier || details?.unit?.name || 'N/A'}
            </p>
          </div>
        );
      }
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (payment: any) => {
        const details = getPaymentWithDetails(payment.id);
        return (
          <div>
            <p className="font-medium">€{payment.amount_due.toLocaleString()}</p>
            {payment.amount_paid !== null && payment.amount_paid < payment.amount_due && (
              <p className="text-sm text-orange-400">
                €{payment.amount_paid} paid
              </p>
            )}
            {details?.plan && (
              <p className="text-xs text-blue-400 flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Payment plan
              </p>
            )}
          </div>
        );
      }
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      accessor: (payment: any) => (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          {format(new Date(payment.due_date), 'MMM d, yyyy')}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (payment: any) => <StatusBadge status={payment.status || 'pending'} />
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (payment: any) => {
        const details = getPaymentWithDetails(payment.id);
        const hasActivePlan = details?.plan?.status === 'active';
        
        return (
          <div className="flex items-center gap-2">
            {(payment.status === 'pending' || payment.status === 'late') && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendReminder(payment.id)}
                >
                  Send Reminder
                </Button>
                {payment.status === 'late' && !hasActivePlan && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedPayment(payment.id);
                      setShowPaymentPlanDialog(true);
                    }}
                  >
                    <CreditCard className="h-3 w-3 mr-1" />
                    Plan
                  </Button>
                )}
              </>
            )}
            {payment.status === 'paid' && (
              <div className="flex items-center gap-1 text-green-500">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Paid</span>
              </div>
            )}
            {payment.status === 'partial' && (
              <span className="text-sm text-orange-400">Partial</span>
            )}
          </div>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading payment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground">Track rent collection and manage payment plans</p>
        </div>
        
        {/* Autonomous Mode Toggle */}
        <Card className="p-4 ai-glow">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="autonomous-mode"
                checked={autonomousMode}
                onCheckedChange={setAutonomousMode}
              />
              <Label htmlFor="autonomous-mode" className="font-medium">
                AI Collection
              </Label>
            </div>
            <div className="text-sm text-muted-foreground">
              Automated reminders & plans
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expected</p>
              <h3 className="text-2xl font-bold">€{monthlyExpected.toLocaleString()}</h3>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <h3 className="text-2xl font-bold text-green-500">
                €{totalCollected.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {collectionRate}% collected
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <h3 className="text-2xl font-bold text-yellow-500">
                €{totalPending.toLocaleString()}
              </h3>
            </div>
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <h3 className="text-2xl font-bold text-red-500">
                €{totalLate.toLocaleString()}
              </h3>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Payment Plans</p>
              <h3 className="text-2xl font-bold text-blue-500">{activePlans}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                €{totalArrears.toLocaleString()} total
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-500" />
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
          variant={filterStatus === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('pending')}
        >
          Pending
        </Button>
        <Button
          variant={filterStatus === 'paid' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('paid')}
        >
          Paid
        </Button>
        <Button
          variant={filterStatus === 'late' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('late')}
        >
          Overdue
        </Button>
      </div>

      {/* Payments Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Payment History</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="ai-glow">
              <Send className="h-4 w-4 mr-1" />
              Send All Reminders
            </Button>
          </div>
        </div>
        
        <DataTable
          columns={columns}
          data={filteredPayments}
          getRowId={(payment) => payment.id}
          emptyMessage="No payments found"
        />
      </Card>

      {/* Active Payment Plans */}
      {activePlans > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Active Payment Plans
            </h3>
            <Badge className="bg-blue-500/10 text-blue-500">
              {activePlans} active
            </Badge>
          </div>
          
          <div className="space-y-3">
            {landlordPaymentPlans
              .slice(0, 5)
              .map(plan => {
                const lease = leases.find(l => l.id === plan.lease_id);
                const tenant = lease ? tenants.find(t => t.lease_id === lease.id) : null;
                const unit = lease ? units.find(u => u.id === lease.unit_id) : null;
                
                return (
                  <div key={plan.id} className="p-4 bg-accent/50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{tenant?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {unit?.unit_identifier || unit?.name} • €{plan.installment_amount}/{plan.installment_frequency}
                        </p>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>Progress</span>
                            <span>€{Math.round(plan.total_arrears * 0.3)} / €{plan.total_arrears}</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: '30%' }} />
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Insights Section */}
      {reportData && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Payment Insights
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Collection Breakdown Chart */}
            <Card className="p-6 col-span-1">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Collection Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={[
                    { name: "On Time", value: reportData.payments_on_time, color: "#22c55e" },
                    { name: "Late",    value: reportData.payments_late,    color: "#f59e0b" },
                    { name: "Missed",  value: reportData.payments_missed,  color: "#ef4444" },
                  ]}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {[
                      { color: "#22c55e" },
                      { color: "#f59e0b" },
                      { color: "#ef4444" },
                    ].map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Collection rate: <span className="font-semibold text-foreground">{reportData.collection_rate}%</span>
                {" · "}£{reportData.total_collected.toLocaleString()} / £{reportData.total_expected.toLocaleString()}
              </p>
            </Card>

            {/* Per-Property Breakdown */}
            <Card className="p-6 col-span-1">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Home className="h-4 w-4" />
                Property Breakdown
              </h3>
              {reportData.property_breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No property data</p>
              ) : (
                <div className="space-y-2">
                  {reportData.property_breakdown.map((prop, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[120px]">{prop.unit_identifier}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">£{prop.collected.toLocaleString()}</span>
                        <Badge
                          className={cn(
                            "text-xs",
                            prop.status === 'paid'
                              ? "bg-green-500/10 text-green-500"
                              : prop.status === 'partial'
                              ? "bg-orange-500/10 text-orange-500"
                              : "bg-red-500/10 text-red-500"
                          )}
                        >
                          {prop.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Late Payer Patterns */}
            <Card className="p-6 col-span-1">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Late Payer Patterns
              </h3>
              {reportData.late_patterns.length === 0 ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1" />
                  <p className="text-sm text-muted-foreground">No recurring late payers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reportData.late_patterns.map((p, i) => (
                    <div key={i} className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                      <p className="text-sm font-medium">{p.tenant_name}</p>
                      <p className="text-xs text-muted-foreground">{p.unit_identifier}</p>
                      <p className="text-xs mt-1 text-yellow-500">
                        Late {p.times_late}× · avg {Math.round(p.avg_days_late)}d overdue
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Payment Plan Dialog */}
      <Dialog open={showPaymentPlanDialog} onOpenChange={setShowPaymentPlanDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Payment Plan</DialogTitle>
            <DialogDescription>
              Set up a structured payment plan for overdue rent
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (() => {
            const details = getPaymentWithDetails(selectedPayment);
            if (!details) return null;
            
            return (
              <div className="space-y-4 py-4">
                <div className="bg-accent/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-1">Tenant</p>
                  <p>{details.tenant?.full_name} - {details.unit?.unit_identifier || details.unit?.name}</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Total Arrears</Label>
                  <Input 
                    type="number" 
                    defaultValue={details.payment.amount_due} 
                    readOnly
                    className="font-mono"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Number of Installments</Label>
                  <Select defaultValue="6">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                      <SelectItem value="24">24 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Payment Frequency</Label>
                  <Select defaultValue="monthly">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="rounded-lg bg-primary/10 p-4">
                  <p className="text-sm font-medium text-primary mb-1">
                    Suggested Installment
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    €{Math.round(details.payment.amount_due / 6)}/month
                  </p>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowPaymentPlanDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => handleCreatePaymentPlan(details.lease.id, details.payment.amount_due)}
                    className="ai-glow"
                  >
                    Create Payment Plan
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}