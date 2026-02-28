'use client';

import { useEffect } from "react";
import { 
  DollarSign, Calendar, CheckCircle, Clock, AlertCircle,
  CreditCard, FileText, Download, ChevronRight
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import StatusBadge from "@/components/shared/StatusBadge";
import useTenantStore from "@/lib/store/tenant";
import { format, differenceInDays, addMonths } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function TenantPaymentsPage() {
  const {
    tenantInfo,
    payments,
    paymentPlans,
    loading,
    fetchTenantData
  } = useTenantStore();

  useEffect(() => {
    if (tenantInfo?.id) {
      fetchTenantData(tenantInfo.id);
    }
  }, [tenantInfo?.id]);

  // Get current payment plan if any
  const activePlan = paymentPlans.find(plan => plan.status === 'active');

  // Calculate payment stats
  const upcomingPayments = payments.filter(p => p.status === 'pending' || p.status === 'late');
  const recentPayments = payments.filter(p => p.status === 'paid').slice(0, 12);
  const overduePayments = payments.filter(p => p.status === 'late');
  
  const totalPaid = recentPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const totalDue = upcomingPayments.reduce((sum, p) => sum + p.amount_due, 0);
  
  // Next payment
  const nextPayment = upcomingPayments.sort((a, b) => 
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )[0];
  
  const daysUntilNext = nextPayment 
    ? differenceInDays(new Date(nextPayment.due_date), new Date())
    : null;

  // Payment history for chart
  const paymentHistory = payments
    .filter(p => p.status === 'paid')
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    .slice(0, 6)
    .reverse();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading payment information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-muted-foreground">
          View your rent payments and payment history
        </p>
      </div>

      {/* Alert for overdue payments */}
      {overduePayments.length > 0 && (
        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div className="flex-1">
              <p className="font-medium text-red-500">Overdue Payment</p>
              <p className="text-sm text-muted-foreground">
                You have {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''} totaling £{overduePayments.reduce((sum, p) => sum + p.amount_due, 0).toLocaleString()}
              </p>
            </div>
            <Button size="sm" variant="outline">
              Contact Landlord
            </Button>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Next Payment */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Next Payment</h3>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            {nextPayment ? (
              <>
                <div>
                  <p className="text-3xl font-bold">£{nextPayment.amount_due.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Due {format(new Date(nextPayment.due_date), 'MMMM d, yyyy')}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{daysUntilNext} days remaining</span>
                    <StatusBadge status={nextPayment.status} />
                  </div>
                  <Progress 
                    value={daysUntilNext && daysUntilNext > 0 ? ((30 - daysUntilNext) / 30) * 100 : 100} 
                    className="h-2"
                  />
                </div>
                <Button className="w-full" disabled={nextPayment.status === 'paid'}>
                  Pay Now
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All payments up to date</p>
              </div>
            )}
          </div>
        </Card>

        {/* Monthly Rent */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Monthly Rent</h3>
              <DollarSign className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-3xl font-bold">£{tenantInfo?.monthly_rent?.toLocaleString() || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Due on the {tenantInfo?.rent_due_day || 1}st of each month
              </p>
            </div>
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Payment Method</p>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">Bank Transfer</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Payment Plan (if active) */}
        {activePlan ? (
          <Card className="p-6 border-blue-500/20">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Payment Plan</h3>
                <Badge className="bg-blue-500/10 text-blue-500">Active</Badge>
              </div>
              <div>
                <p className="text-3xl font-bold">£{activePlan.installment_amount}/mo</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Additional to monthly rent
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span>£{Math.round(activePlan.total_arrears * 0.3)} / £{activePlan.total_arrears}</span>
                </div>
                <Progress value={30} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  70% remaining
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Payment Status</h3>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-green-500">Good</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No outstanding issues
                </p>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  You've made {recentPayments.filter(p => p.status === 'paid').length} on-time payments
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Upcoming Payments */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Upcoming Payments</h3>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-1" />
            Set Reminders
          </Button>
        </div>
        <div className="space-y-3">
          {upcomingPayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-muted-foreground">No upcoming payments</p>
            </div>
          ) : (
            upcomingPayments.slice(0, 3).map((payment, idx) => (
              <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg bg-accent/50">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium",
                    idx === 0 ? "bg-primary text-primary-foreground" : "bg-secondary"
                  )}>
                    {format(new Date(payment.due_date), 'd')}
                  </div>
                  <div>
                    <p className="font-medium">£{payment.amount_due.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.due_date), 'MMMM yyyy')} Rent
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={payment.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Payment History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Payment History</h3>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
        <div className="space-y-3">
          {recentPayments.map(payment => (
            <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg bg-accent/50">
              <div>
                <p className="font-medium">£{(payment.amount_paid || payment.amount_due).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(payment.payment_date || payment.due_date), 'MMMM d, yyyy')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status="paid" />
                <Button variant="ghost" size="sm">
                  <FileText className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment Information */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Payment Information</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Bank Details</p>
            <div className="p-4 bg-accent/50 rounded-lg font-mono text-sm">
              <p>Account Name: {tenantInfo?.landlord_name || 'PropAI Landlord'}</p>
              <p>Sort Code: 12-34-56</p>
              <p>Account Number: 87654321</p>
              <p>Reference: {tenantInfo?.unit_identifier || 'UNIT-REF'}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Need help with payments?</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Contact Support
              </Button>
              <Button variant="outline" size="sm">
                Request Payment Plan
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}