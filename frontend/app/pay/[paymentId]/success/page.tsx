'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, AlertCircle, MessageCircle } from 'lucide-react';
import { confirmStripePayment, type ConfirmPaymentResponse } from '@/lib/api/stripe';

export default function PaymentSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const paymentId = params.paymentId as string;
  const sessionId = searchParams.get('session_id');

  const [result, setResult] = useState<ConfirmPaymentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function confirm() {
      if (!sessionId) {
        setError('Missing session ID');
        setLoading(false);
        return;
      }
      try {
        const data = await confirmStripePayment(paymentId, sessionId);
        setResult(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to confirm payment';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    confirm();
  }, [paymentId, sessionId]);

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Confirming your payment...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">PropAI</h1>
        </div>

        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-xl font-semibold">Payment Confirmed</h2>
            <p className="text-muted-foreground">
              {result?.message || 'Your payment has been successfully processed.'}
            </p>

            {result?.receipt_sent && (
              <div className="flex items-center justify-center gap-2 rounded-md bg-green-500/15 p-3 text-sm text-green-400">
                <MessageCircle className="h-4 w-4" />
                WhatsApp receipt sent
              </div>
            )}

            <p className="text-xs text-muted-foreground pt-4">
              You can safely close this page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
