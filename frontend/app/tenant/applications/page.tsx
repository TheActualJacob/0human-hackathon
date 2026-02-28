'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText, MapPin, Calendar, DollarSign, 
  Clock, CheckCircle, XCircle, AlertCircle,
  Brain, Home
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/lib/supabase/database.types';

type PropertyApplication = Database['public']['Tables']['property_applications']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];

interface ApplicationWithUnit extends PropertyApplication {
  units?: Unit;
}

export default function TenantApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationWithUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('property_applications')
        .select(`
          *,
          units (
            id,
            unit_identifier,
            address,
            city,
            rent_amount,
            available_date,
            listing_status
          )
        `)
        .eq('tenant_id', user.entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setApplications(data || []);
    } catch (err) {
      console.error('Error loading applications:', err);
      setError('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, icon: Clock, label: 'Pending' },
      ai_screening: { variant: 'outline' as const, icon: Brain, label: 'AI Screening' },
      under_review: { variant: 'outline' as const, icon: AlertCircle, label: 'Under Review' },
      accepted: { variant: 'success' as const, icon: CheckCircle, label: 'Accepted' },
      rejected: { variant: 'destructive' as const, icon: XCircle, label: 'Rejected' },
      withdrawn: { variant: 'secondary' as const, icon: XCircle, label: 'Withdrawn' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getScoreBadge = (score: number | null) => {
    if (!score) return null;
    
    const percentage = Math.round(score * 100);
    const variant = percentage >= 75 ? 'success' : percentage >= 50 ? 'secondary' : 'destructive';
    
    return (
      <Badge variant={variant as any}>
        AI Score: {percentage}%
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Applications</h1>
          <p className="text-muted-foreground">Track your rental applications</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Applications</h1>
          <p className="text-muted-foreground">Track your rental applications</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeApplications = applications.filter(app => 
    ['pending', 'ai_screening', 'under_review'].includes(app.status || '')
  );

  const pastApplications = applications.filter(app => 
    ['accepted', 'rejected', 'withdrawn'].includes(app.status || '')
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Applications</h1>
        <p className="text-muted-foreground">
          {activeApplications.length} active application{activeApplications.length !== 1 ? 's' : ''}
        </p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Applications Yet</h3>
            <p className="text-muted-foreground mb-4">
              You haven't submitted any rental applications
            </p>
            <Button asChild>
              <Link href="/properties">Browse Properties</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active Applications */}
          {activeApplications.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Active Applications</h2>
              {activeApplications.map((application) => (
                <Card key={application.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">
                          {application.units?.unit_identifier || 'Property'}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {application.units?.address}, {application.units?.city}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(application.status || 'pending')}
                        {getScoreBadge(application.ai_screening_score)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Application Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Applied</p>
                        <p className="font-medium">
                          {formatDistanceToNow(new Date(application.created_at!), { addSuffix: true })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Monthly Rent</p>
                        <p className="font-medium">£{application.units?.rent_amount || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-medium">
                          {application.units?.available_date 
                            ? new Date(application.units.available_date).toLocaleDateString()
                            : 'Immediately'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Application #</p>
                        <p className="font-mono text-xs">{application.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    {/* AI Screening Results Summary */}
                    {application.ai_screening_result && (
                      <Alert>
                        <Brain className="h-4 w-4" />
                        <AlertDescription>
                          <strong>AI Screening Complete:</strong> {application.ai_screening_result.summary || 'Your application has been analyzed and is ready for landlord review.'}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Status-specific messages */}
                    {application.status === 'pending' && (
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          Your application is being processed. You'll be notified once screening is complete.
                        </AlertDescription>
                      </Alert>
                    )}

                    {application.status === 'under_review' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          The landlord is reviewing your application. You should hear back within 2-3 business days.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/properties/${application.unit_id}`}>
                          View Property
                        </Link>
                      </Button>
                      {application.status === 'pending' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // TODO: Implement withdraw functionality
                            alert('Withdraw functionality coming soon');
                          }}
                        >
                          Withdraw Application
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Past Applications */}
          {pastApplications.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Past Applications</h2>
              {pastApplications.map((application) => (
                <Card key={application.id} className="opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {application.units?.unit_identifier || 'Property'}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {application.units?.address}, {application.units?.city}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(application.status || 'pending')}
                        {getScoreBadge(application.ai_screening_score)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-muted-foreground">
                        Applied {formatDistanceToNow(new Date(application.created_at!), { addSuffix: true })}
                      </p>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/properties/${application.unit_id}`}>
                          View Property
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Application Limit Notice */}
      {activeApplications.length >= 5 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've reached the maximum of 5 active applications. 
            Wait for responses or withdraw an application before applying to more properties.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}