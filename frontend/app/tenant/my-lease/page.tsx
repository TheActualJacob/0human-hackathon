'use client';

import { useEffect, useState } from 'react';
import {
  FileText, Home, DollarSign, Calendar, AlertCircle,
  CheckCircle, Clock, PenTool, ArrowLeft, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import Link from 'next/link';
import useTenantStore from '@/lib/store/tenant';
import useAuthStore from '@/lib/store/auth';
import { getCurrentUser } from '@/lib/auth/client';
import { createClient } from '@/lib/supabase/client';

interface SigningToken {
  id: string;
  signed_at: string | null;
  created_at: string;
  unit_address: string | null;
}

export default function MyLeasePage() {
  const { user, setUser } = useAuthStore();
  const { tenantInfo, loading, fetchTenantData } = useTenantStore();
  const [signingToken, setSigningToken] = useState<SigningToken | null | undefined>(undefined); // undefined = loading

  // Load tenant data
  useEffect(() => {
    async function load() {
      if (!user) {
        const currentUser = await getCurrentUser();
        if (currentUser) setUser(currentUser);
      }
      if (user?.entityId) {
        fetchTenantData(user.entityId);
      }
    }
    load();
  }, [user, setUser, fetchTenantData]);

  // Load signing token once we have the tenant's phone number
  useEffect(() => {
    if (!tenantInfo?.whatsapp_number) {
      setSigningToken(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from('signing_tokens')
      .select('id, signed_at, created_at, unit_address')
      .eq('prospect_phone', tenantInfo.whatsapp_number)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSigningToken(data));
  }, [tenantInfo?.whatsapp_number]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading lease...</p>
        </div>
      </div>
    );
  }

  if (!tenantInfo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Unable to load tenant information</p>
          <Link href="/tenant/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const lease = tenantInfo.leases;
  const unit = lease?.units;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tenant/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">My Lease</h1>
          <p className="text-muted-foreground">Your tenancy agreement details</p>
        </div>
      </div>

      {!lease ? (
        <Card className="p-8 text-center space-y-4">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">No Active Lease</h2>
          <p className="text-muted-foreground">
            You don't have a lease on file yet. If you've applied for a property, your landlord will be in touch once your application is reviewed.
          </p>
        </Card>
      ) : (
        <>
          {/* Signing Status */}
          {lease.status === 'pending' && (
            <Card className={`p-5 border-2 ${signingToken?.signed_at ? 'border-green-500/40 bg-green-500/5' : 'border-yellow-500/40 bg-yellow-500/5'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {signingToken?.signed_at ? (
                    <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <PenTool className="h-6 w-6 text-yellow-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    {signingToken?.signed_at ? (
                      <>
                        <p className="font-semibold text-green-500">Lease Signed</p>
                        <p className="text-sm text-muted-foreground">
                          You signed this agreement on {format(new Date(signingToken.signed_at), 'MMMM d, yyyy')}.
                        </p>
                      </>
                    ) : signingToken ? (
                      <>
                        <p className="font-semibold text-yellow-500">Action Required — Please Sign Your Lease</p>
                        <p className="text-sm text-muted-foreground">
                          Your tenancy agreement is ready. Review and sign it to confirm your tenancy.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">Agreement Being Prepared</p>
                        <p className="text-sm text-muted-foreground">
                          Your tenancy agreement will be sent to you via WhatsApp shortly.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {signingToken && !signingToken.signed_at && (
                  <Link href={`/sign/${signingToken.id}`}>
                    <Button className="gap-2 shrink-0">
                      <PenTool className="h-4 w-4" />
                      Sign Now
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          )}

          {/* Lease Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Lease Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Home className="h-3.5 w-3.5" />
                    Property
                  </p>
                  <p className="font-medium">{unit?.unit_identifier || unit?.name || 'Unknown Unit'}</p>
                  {unit?.address && (
                    <p className="text-sm text-muted-foreground">
                      {[unit.address, unit.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={
                    lease.status === 'active' ? 'default' :
                    lease.status === 'pending' ? 'secondary' :
                    lease.status === 'expired' ? 'destructive' : 'outline'
                  }>
                    {lease.status ? lease.status.charAt(0).toUpperCase() + lease.status.slice(1) : 'Unknown'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Start Date
                  </p>
                  <p className="font-medium">
                    {lease.start_date ? format(new Date(lease.start_date), 'MMMM d, yyyy') : '—'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    End Date
                  </p>
                  <p className="font-medium">
                    {lease.end_date ? format(new Date(lease.end_date), 'MMMM d, yyyy') : 'Open-ended'}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Monthly Rent
                  </p>
                  <p className="font-medium text-lg">£{lease.monthly_rent?.toLocaleString() ?? '—'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Security Deposit</p>
                  <p className="font-medium">£{lease.deposit_amount?.toLocaleString() ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
