'use client';

import { useState } from "react";
import { DollarSign, Send, AlertCircle, CheckCircle } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import useStore from "@/lib/store/useStore";
import { format } from "date-fns";

export default function RentPage() {
  const { rentPayments, sendRentReminder, applyLateFee, addActivity } = useStore();
  const [autonomousMode, setAutonomousMode] = useState(true);

  // Calculate summary stats
  const totalExpected = rentPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalCollected = rentPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = rentPayments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalLate = rentPayments
    .filter(p => p.status === 'late')
    .reduce((sum, p) => sum + p.amount + (p.lateFee || 0), 0);

  const collectionRate = totalExpected > 0 
    ? Math.round((totalCollected / totalExpected) * 100) 
    : 0;

  const handleSendReminder = (paymentId: string) => {
    const payment = rentPayments.find(p => p.id === paymentId);
    if (!payment) return;

    sendRentReminder(payment.tenantId);
    
    // Update payment to show reminder sent
    useStore.getState().updateRentPayment(paymentId, { aiReminded: true });
  };

  const handleApplyLateFee = (paymentId: string) => {
    const payment = rentPayments.find(p => p.id === paymentId);
    if (!payment || payment.lateFee) return;

    const fee = Math.round(payment.amount * 0.05); // 5% late fee
    applyLateFee(paymentId, fee);
  };

  const columns = [
    {
      key: 'tenant',
      header: 'Tenant',
      accessor: (payment) => (
        <div>
          <p className="font-medium">{payment.tenantName}</p>
          <p className="text-sm text-muted-foreground">Unit {payment.unit}</p>
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (payment) => (
        <div>
          <p className="font-medium">${payment.amount.toLocaleString()}</p>
          {payment.lateFee && (
            <p className="text-sm text-destructive">
              +${payment.lateFee} late fee
            </p>
          )}
        </div>
      )
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      accessor: (payment) => format(new Date(payment.dueDate), 'MMM d, yyyy')
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (payment) => <StatusBadge status={payment.status} />
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (payment) => (
        <div className="flex items-center gap-2">
          {(payment.status === 'pending' || payment.status === 'late') && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendReminder(payment.id)}
                disabled={payment.aiReminded}
              >
                {payment.aiReminded ? 'Reminded' : 'Send Reminder'}
              </Button>
              {payment.status === 'late' && !payment.lateFee && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleApplyLateFee(payment.id)}
                >
                  Apply Late Fee
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
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rent Collection</h1>
          <p className="text-muted-foreground">Manage monthly rent payments</p>
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
                Autonomous Mode
              </Label>
            </div>
            <div className="text-sm text-muted-foreground">
              AI handles late fees & reminders
            </div>
          </div>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expected</p>
              <h3 className="text-2xl font-bold">${totalExpected.toLocaleString()}</h3>
            </div>
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Collected</p>
              <h3 className="text-2xl font-bold text-green-500">
                ${totalCollected.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {collectionRate}% collection rate
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
                ${totalPending.toLocaleString()}
              </h3>
            </div>
            <Send className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Late</p>
              <h3 className="text-2xl font-bold text-red-500">
                ${totalLate.toLocaleString()}
              </h3>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Rent Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">March 2024 Rent Roll</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="ai-glow">
              Send All Reminders
            </Button>
          </div>
        </div>
        
        <DataTable
          columns={columns}
          data={rentPayments}
          getRowId={(payment) => payment.id}
          emptyMessage="No rent payments found"
        />
      </Card>

      {/* Auto-Late Fee Settings */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Late Fee Rules</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
            <div>
              <p className="font-medium">Automatic Late Fees</p>
              <p className="text-sm text-muted-foreground">
                Apply 5% late fee after 5 days
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
            <div>
              <p className="font-medium">Grace Period</p>
              <p className="text-sm text-muted-foreground">
                5 days after due date
              </p>
            </div>
            <span className="text-sm font-medium">5 days</span>
          </div>
          
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary">
            <div>
              <p className="font-medium">Reminder Frequency</p>
              <p className="text-sm text-muted-foreground">
                Send reminders every 3 days
              </p>
            </div>
            <span className="text-sm font-medium">3 days</span>
          </div>
        </div>
      </Card>
    </div>
  );
}