'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Home,
  User,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  getPaymentInfo,
  createCheckoutSession,
  type PaymentInfo,
} from '@/lib/api/stripe';

export default function TenantPayPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;

  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getPaymentInfo(paymentId);
        setInfo(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load payment';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [paymentId]);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/pay/${paymentId}/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/pay/${paymentId}`;

      const { checkout_url } = await createCheckoutSession(
        paymentId,
        successUrl,
        cancelUrl
      );
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start payment';
      setError(message);
      setPaying(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // Error state (payment not found or already paid)
  if (error && !info) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Unable to Load Payment</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!info) return null;

  // Already paid state
  if (info.status === 'paid') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-lg font-semibold">Payment Already Completed</h2>
            <p className="mt-2 text-muted-foreground">
              This payment has already been processed. No further action is needed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColor =
    info.status === 'late'
      ? 'bg-red-500/15 text-red-400'
      : 'bg-yellow-500/15 text-yellow-400';

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">PropAI</h1>
          <p className="text-sm text-muted-foreground">Secure Rent Payment</p>
        </div>

        {/* Payment Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Payment Details</CardTitle>
              <Badge className={statusColor}>
                {info.status === 'late' ? 'Overdue' : 'Due'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Amount */}
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-4xl font-bold tracking-tight">
                £{info.amount_due.toFixed(2)}
              </p>
            </div>

            <Separator />

            {/* Details */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tenant</p>
                  <p className="text-sm font-medium">{info.tenant_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Home className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="text-sm font-medium">{info.unit_identifier}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="text-sm font-medium">{info.due_date}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Error message */}
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Pay button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting to payment...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay £{info.amount_due.toFixed(2)}
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Secure payment processed by Stripe
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
