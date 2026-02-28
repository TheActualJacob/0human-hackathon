import { CreditCard, Calendar, TrendingUp, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addMonths } from 'date-fns';
import type { PaymentPlan, Payment } from '@/types';

interface PaymentPlanTrackerProps {
  paymentPlan: PaymentPlan;
  payments?: Payment[];
  className?: string;
}

export default function PaymentPlanTracker({ 
  paymentPlan, 
  payments = [],
  className 
}: PaymentPlanTrackerProps) {
  // Calculate plan progress
  const startDate = new Date(paymentPlan.start_date);
  const endDate = paymentPlan.end_date ? new Date(paymentPlan.end_date) : null;
  
  // Filter payments that are part of this plan (after plan start date)
  const planPayments = payments.filter(p => 
    new Date(p.due_date) >= startDate && p.status === 'paid'
  );
  
  const totalPaid = planPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  const progressPercentage = Math.min(100, Math.round((totalPaid / paymentPlan.total_arrears) * 100));
  
  // Calculate expected installments
  const monthsPassed = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const expectedInstallments = Math.min(
    monthsPassed + 1,
    Math.ceil(paymentPlan.total_arrears / paymentPlan.installment_amount)
  );
  const expectedAmount = expectedInstallments * paymentPlan.installment_amount;
  const isOnTrack = totalPaid >= expectedAmount * 0.9; // 90% tolerance
  
  // Generate installment schedule
  const totalInstallments = Math.ceil(paymentPlan.total_arrears / paymentPlan.installment_amount);
  const installments = Array.from({ length: totalInstallments }, (_, i) => {
    const dueDate = paymentPlan.installment_frequency === 'monthly' 
      ? addMonths(startDate, i)
      : new Date(startDate.getTime() + (i * 14 * 24 * 60 * 60 * 1000)); // Fortnightly
      
    const isPaid = i < Math.floor(totalPaid / paymentPlan.installment_amount);
    const isCurrent = i === Math.floor(totalPaid / paymentPlan.installment_amount);
    
    return {
      number: i + 1,
      dueDate,
      amount: i === totalInstallments - 1 
        ? paymentPlan.total_arrears - (paymentPlan.installment_amount * i)
        : paymentPlan.installment_amount,
      isPaid,
      isCurrent
    };
  });

  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Payment Plan Progress</h3>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Started {format(startDate, 'MMM d, yyyy')}
            </span>
            <span className={cn(
              "flex items-center gap-1",
              isOnTrack ? "text-green-500" : "text-yellow-500"
            )}>
              <TrendingUp className="h-3 w-3" />
              {isOnTrack ? "On track" : "Behind schedule"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">£{totalPaid.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">
            of £{paymentPlan.total_arrears.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{progressPercentage}%</span>
        </div>
        <div className="h-3 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Plan Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-accent/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Installment Amount</p>
          <p className="font-medium">
            £{paymentPlan.installment_amount} / {paymentPlan.installment_frequency}
          </p>
        </div>
        <div className="bg-accent/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Remaining</p>
          <p className="font-medium">
            £{(paymentPlan.total_arrears - totalPaid).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Installment Schedule */}
      <div>
        <h4 className="font-medium mb-3">Installment Schedule</h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {installments.slice(0, 6).map((installment) => (
            <div 
              key={installment.number}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                installment.isPaid && "bg-green-500/10",
                installment.isCurrent && "bg-primary/10 border border-primary/30",
                !installment.isPaid && !installment.isCurrent && "bg-accent/50"
              )}
            >
              <div className="flex items-center gap-3">
                {installment.isPaid ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2",
                    installment.isCurrent ? "border-primary" : "border-muted-foreground"
                  )} />
                )}
                <div>
                  <p className="text-sm font-medium">
                    Installment {installment.number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due {format(installment.dueDate, 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <span className={cn(
                "font-medium",
                installment.isPaid && "text-green-500"
              )}>
                £{installment.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        
        {installments.length > 6 && (
          <p className="text-sm text-muted-foreground text-center mt-3">
            +{installments.length - 6} more installments
          </p>
        )}
      </div>

      {/* Status */}
      <div className={cn(
        "mt-6 p-3 rounded-lg text-center",
        paymentPlan.status === 'active' && "bg-blue-500/10 text-blue-500",
        paymentPlan.status === 'completed' && "bg-green-500/10 text-green-500",
        paymentPlan.status === 'breached' && "bg-red-500/10 text-red-500"
      )}>
        <p className="text-sm font-medium">
          Plan Status: {paymentPlan.status?.toUpperCase()}
        </p>
      </div>
    </div>
  );
}