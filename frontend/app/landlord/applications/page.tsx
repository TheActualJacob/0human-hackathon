'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText, MapPin, DollarSign,
  Clock, CheckCircle, XCircle, AlertCircle, Brain,
  Home, Phone, TrendingUp, TrendingDown,
  MessageSquare, Mail, ChevronDown, ChevronUp
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Database } from '@/lib/supabase/database.types';

type PropertyApplication = Database['public']['Tables']['property_applications']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

interface ApplicationWithDetails extends PropertyApplication {
  units?: Unit;
  tenants?: Tenant;
}

export default function LandlordApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationWithDetails | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  
  const supabase = createClient();

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Get all units owned by this landlord
      const { data: units } = await supabase
        .from('units')
        .select('id')
        .eq('landlord_id', user.entityId);

      if (!units || units.length === 0) {
        setApplications([]);
        setLoading(false);
        return;
      }

      const unitIds = units.map(u => u.id);

      // Get all applications for these units
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
            security_deposit,
            available_date
          ),
          tenants (
            id,
            full_name,
            email,
            whatsapp_number
          )
        `)
        .in('unit_id', unitIds)
        .order('ai_screening_score', { ascending: false, nullsFirst: false })
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

  const handleAcceptApplication = async (application: ApplicationWithDetails) => {
    setProcessing(true);
    try {
      // Update application status
      const { error: updateError } = await supabase
        .from('property_applications')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id);

      if (updateError) throw updateError;

      // Create lease for accepted tenant
      const { error: leaseError } = await supabase
        .from('leases')
        .insert({
          unit_id: application.unit_id,
          start_date: application.units?.available_date || new Date().toISOString(),
          monthly_rent: application.units?.rent_amount || 0,
          deposit_amount: application.units?.security_deposit || application.units?.rent_amount || 0,
          status: 'pending'
        })
        .select()
        .single();

      if (leaseError) throw leaseError;

      // Create a signing token so the applicant gets a lease signing link
      const appData = application.applicant_data as any;
      const applicantName = application.tenants?.full_name || appData?.fullName || 'Applicant';
      const propertyAddress = application.units?.address || application.units?.unit_identifier || 'the property';
      const monthlyRent = application.units?.rent_amount || 0;

      const leaseContent = `TENANCY AGREEMENT

1. PARTIES
This agreement is between Robert Ryan (Landlord) and ${applicantName} (Tenant).

2. PROPERTY
The landlord agrees to let the property at ${propertyAddress} to the tenant for residential use only.

3. TERM
The tenancy shall commence on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} for a period of 12 months.

4. RENT
The tenant shall pay £${monthlyRent} per calendar month, due on the 1st of each month by bank transfer.

5. DEPOSIT
A deposit of £${monthlyRent * 2} is payable on signing, to be protected under the Tenancy Deposit Scheme (TDS) within 30 days.

6. TENANT OBLIGATIONS
The tenant agrees to:
- Pay rent on time each month
- Keep the property clean and in good condition
- Report any damage or maintenance issues promptly
- Not sublet the property without written consent
- Allow access for inspections with reasonable notice (minimum 24 hours)

7. LANDLORD OBLIGATIONS
The landlord agrees to:
- Keep the property in a good state of repair
- Respond to urgent repairs within 24 hours and routine repairs within 28 days
- Protect the tenant's deposit in an approved scheme

8. TERMINATION
Either party may end this tenancy by giving 1 month's written notice after the fixed term expires.

9. GOVERNING LAW
This agreement is governed by the laws of England and Wales.`;

      let signingUrl: string | null = null;
      try {
        const tokenRes = await fetch('/api/sign/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospect_name: applicantName,
            unit_address: propertyAddress,
            monthly_rent: monthlyRent,
            lease_content: leaseContent,
            prospect_phone: appData?.whatsappNumber || null,
          }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.id) {
            signingUrl = `${window.location.origin}/sign/${tokenData.id}`;
          }
        } else {
          console.error('sign/create failed:', await tokenRes.text());
        }
      } catch (tokenErr) {
        console.error('Failed to create signing token (non-fatal):', tokenErr);
      }

      // Send acceptance email with signing link
      const email = application.tenants?.email || appData?.email;
      if (email) {
        try {
          const emailRes = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'accepted',
              to: email,
              applicantName,
              propertyAddress,
              landlordName: 'Robert Ryan',
              signingUrl,
            }),
          });
          if (!emailRes.ok) {
            const err = await emailRes.json().catch(() => ({}));
            console.error('Email API error:', err);
            notify('error', `Application accepted but email failed: ${err.details || 'unknown error'}`);
            await loadApplications();
            return;
          }
        } catch (emailErr) {
          console.error('Email fetch error:', emailErr);
          notify('error', 'Application accepted but email could not be sent.');
          await loadApplications();
          return;
        }
      }

      await loadApplications();
      notify('success', 'Application accepted — lease created and applicant notified.');
    } catch (err) {
      console.error('Error accepting application:', err);
      notify('error', 'Failed to accept application. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleScreenApplication = async (application: ApplicationWithDetails) => {
    setScreeningId(application.id);
    try {
      const appData = application.applicant_data as any;
      const unit = application.units as any;

      const response = await fetch('/api/screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: application.id,
          applicationData: {
            fullName:               appData?.fullName       || 'Unknown',
            email:                  appData?.email          || '',
            whatsappNumber:         appData?.whatsappNumber || '',
            employmentStatus:       appData?.employmentStatus || 'unknown',
            monthlyIncome:          appData?.monthlyIncome  || '0',
            currentEmployer:        appData?.currentEmployer,
            employmentDuration:     appData?.employmentDuration,
            hasRentalHistory:       appData?.hasRentalHistory ?? false,
            currentAddress:         appData?.currentAddress,
            reasonForMoving:        appData?.reasonForMoving,
            hasPets:                appData?.hasPets ?? false,
            petDetails:             appData?.petDetails,
            preferredMoveInDate:    appData?.preferredMoveInDate || new Date().toISOString(),
            numberOfOccupants:      appData?.numberOfOccupants,
            previousLandlordContact: appData?.previousLandlordContact,
            coverLetter:            appData?.coverLetter,
          },
          propertyRequirements: {
            rentAmount:      unit?.rent_amount      || 0,
            securityDeposit: unit?.security_deposit || 0,
            availableDate:   unit?.available_date   || new Date().toISOString(),
            petPolicy:       unit?.pet_policy       || 'case_by_case',
            address:         unit?.address,
            city:            unit?.city,
          },
        }),
      });

      if (!response.ok) throw new Error('Screening request failed');
      await loadApplications();
    } catch (err) {
      console.error('Screening error:', err);
      notify('error', 'AI screening failed — please try again.');
    } finally {
      setScreeningId(null);
    }
  };

  const handleRejectApplication = async () => {
    if (!selectedApplication) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('property_applications')
        .update({ 
          status: 'rejected',
          landlord_notes: rejectReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedApplication.id);

      if (error) throw error;

      // Send rejection email
      const appData = selectedApplication.applicant_data as any;
      const email = selectedApplication.tenants?.email || appData?.email;
      if (email) {
        try {
          const emailRes = await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'rejected',
              to: email,
              applicantName: selectedApplication.tenants?.full_name || appData?.fullName || 'Applicant',
              propertyAddress: selectedApplication.units?.address || selectedApplication.units?.unit_identifier || 'the property',
              landlordName: 'Robert Ryan',
              rejectionReason: rejectReason,
            }),
          });
          if (!emailRes.ok) {
            const err = await emailRes.json().catch(() => ({}));
            console.error('Email API error:', err);
            notify('error', `Application rejected but email failed: ${err.details || 'unknown error'}`);
            await loadApplications();
            setShowRejectDialog(false);
            setRejectReason('');
            setSelectedApplication(null);
            return;
          }
        } catch (emailErr) {
          console.error('Email fetch error:', emailErr);
        }
      }

      await loadApplications();
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedApplication(null);
    } catch (err) {
      console.error('Error rejecting application:', err);
      notify('error', 'Failed to reject application. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'secondary' as const, icon: Clock, label: 'Pending' },
      ai_screening: { variant: 'outline' as const, icon: Brain, label: 'AI Screening' },
      under_review: { variant: 'outline' as const, icon: AlertCircle, label: 'Under Review' },
      accepted: { variant: 'default' as const, icon: CheckCircle, label: 'Accepted' },
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

  const getScoreIndicator = (score: number | null) => {
    if (!score) return null;
    
    const percentage = Math.round(score * 100);
    const Icon = percentage >= 75 ? TrendingUp : percentage >= 50 ? TrendingUp : TrendingDown;
    const color = percentage >= 75 ? 'text-green-500' : percentage >= 50 ? 'text-yellow-500' : 'text-red-500';
    
    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-4 w-4" />
        <span className="font-semibold">{percentage}%</span>
      </div>
    );
  };

  const filteredApplications = applications.filter(app => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ['pending', 'ai_screening', 'under_review'].includes(app.status || '');
    if (activeTab === 'accepted') return app.status === 'accepted';
    if (activeTab === 'rejected') return app.status === 'rejected';
    return true;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Rental Applications</h1>
          <p className="text-muted-foreground">Review and manage tenant applications</p>
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

  return (
    <div className="p-6 space-y-6">
      {notification && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium shadow-sm border ${
          notification.type === 'success'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success'
              ? <CheckCircle className="h-4 w-4 shrink-0" />
              : <XCircle className="h-4 w-4 shrink-0" />}
            {notification.message}
          </div>
          <button onClick={() => setNotification(null)} className="ml-4 opacity-60 hover:opacity-100 transition-opacity">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Rental Applications</h1>
        <p className="text-muted-foreground">
          {applications.length} total application{applications.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Applications</TabsTrigger>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {filteredApplications.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Applications</h3>
                <p className="text-muted-foreground">
                  {activeTab === 'all' 
                    ? "You haven't received any rental applications yet"
                    : `No ${activeTab} applications`}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredApplications.map((application) => {
              const appData = application.applicant_data as any;
              const screeningResult = application.ai_screening_result as any;
              const displayName  = application.tenants?.full_name  || appData?.fullName || 'Unknown Applicant';
              const displayEmail = application.tenants?.email      || appData?.email    || '—';
              const displayPhone = application.tenants?.whatsapp_number || appData?.whatsappNumber || '—';
              const isScreening  = screeningId === application.id;
              const isExpanded   = expandedIds.has(application.id);

              return (
              <Card key={application.id} className="overflow-hidden">
                {/* ── Collapsed row (always visible) ── */}
                <button
                  className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(application.id)}
                >
                  {/* Name + property */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <Home className="h-3 w-3 shrink-0" />
                      {application.units?.unit_identifier || '—'}
                    </p>
                  </div>

                  {/* Income */}
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Income</p>
                    <p className="text-sm font-medium">
                      £{appData?.monthlyIncome || '—'}<span className="text-muted-foreground">/mo</span>
                    </p>
                  </div>

                  {/* AI Score */}
                  <div className="shrink-0 text-right">
                    {application.ai_screening_score !== null
                      ? getScoreIndicator(application.ai_screening_score)
                      : <span className="text-xs text-muted-foreground">No score</span>
                    }
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">{getStatusBadge(application.status || 'pending')}</div>

                  {/* Chevron */}
                  <div className="shrink-0 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* ── Expanded details ── */}
                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 space-y-4">
                    {/* Contact + meta */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Email</p>
                        <p className="font-medium truncate">{displayEmail}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Phone</p>
                        <p className="font-medium">{displayPhone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Employment</p>
                        <p className="font-medium capitalize">{appData?.employmentStatus?.replace(/_/g, ' ') || '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Move-in</p>
                        <p className="font-medium">
                          {appData?.preferredMoveInDate
                            ? format(new Date(appData.preferredMoveInDate), 'MMM d, yyyy')
                            : 'ASAP'}
                        </p>
                      </div>
                    </div>

                    {/* AI Screening Results */}
                    {screeningResult && (
                      <Alert className="bg-primary/5">
                        <Brain className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">AI Screening Summary</p>
                              {screeningResult.details?.aiProvider && (
                                <Badge variant="outline" className="text-xs">
                                  {screeningResult.details.aiProvider === 'claude-3-sonnet' ? 'Claude AI' : 'Rule-based'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm">{screeningResult.summary}</p>

                            {screeningResult.riskFactors && (
                              <div className="flex gap-4 text-sm flex-wrap">
                                {(['financialRisk','stabilityRisk','propertyRisk'] as const).map(key => (
                                  <div key={key} className="flex items-center gap-1">
                                    <span className="font-medium capitalize">{key.replace('Risk','')}: </span>
                                    <Badge variant={screeningResult.riskFactors[key] === 'low' ? 'default' : screeningResult.riskFactors[key] === 'medium' ? 'secondary' : 'destructive'} className="text-xs">
                                      {screeningResult.riskFactors[key]}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}

                            {screeningResult.strengths?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-green-600">Strengths:</p>
                                <ul className="text-sm list-disc list-inside space-y-0.5">
                                  {screeningResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                                </ul>
                              </div>
                            )}

                            {screeningResult.concerns?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-yellow-600">Concerns:</p>
                                <ul className="text-sm list-disc list-inside space-y-0.5">
                                  {screeningResult.concerns.map((c: string, i: number) => <li key={i}>{c}</li>)}
                                </ul>
                              </div>
                            )}

                            {screeningResult.details?.verificationNeeded?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-blue-600">Verification Required:</p>
                                <ul className="text-sm list-disc list-inside space-y-0.5">
                                  {screeningResult.details.verificationNeeded.map((v: string, i: number) => <li key={i}>{v}</li>)}
                                </ul>
                              </div>
                            )}

                            {screeningResult.details?.additionalInsights && (
                              <div className="bg-muted/50 p-3 rounded text-sm">
                                <p className="font-medium mb-1">Additional Insights:</p>
                                <p>{screeningResult.details.additionalInsights}</p>
                              </div>
                            )}

                            {screeningResult.details?.suggestedQuestions?.length > 0 && (
                              <div>
                                <p className="text-sm font-medium text-purple-600">Suggested Questions:</p>
                                <ul className="text-sm list-disc list-inside space-y-0.5">
                                  {screeningResult.details.suggestedQuestions.map((q: string, i: number) => <li key={i}>{q}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Cover Letter */}
                    {appData?.coverLetter && (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />Cover Letter
                        </p>
                        <p className="text-sm">{appData.coverLetter}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {['pending', 'ai_screening', 'under_review'].includes(application.status || '') && (
                      <div className="flex gap-2 flex-wrap">
                        {!application.ai_screening_result && (
                          <Button size="sm" variant="outline" onClick={() => handleScreenApplication(application)} disabled={isScreening || processing}>
                            <Brain className={`h-4 w-4 mr-2 ${isScreening ? 'animate-pulse' : ''}`} />
                            {isScreening ? 'Screening...' : 'Screen with AI'}
                          </Button>
                        )}
                        <Button size="sm" onClick={() => handleAcceptApplication(application)} disabled={processing || isScreening}>
                          <CheckCircle className="h-4 w-4 mr-2" />Accept
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setSelectedApplication(application); setShowRejectDialog(true); }} disabled={processing || isScreening}>
                          <XCircle className="h-4 w-4 mr-2" />Reject
                        </Button>
                      </div>
                    )}

                    {application.status === 'accepted' && (
                      <Alert className="bg-green-500/10">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <AlertDescription>Accepted on {format(new Date(application.updated_at!), 'MMM d, yyyy')}</AlertDescription>
                      </Alert>
                    )}

                    {application.status === 'rejected' && (
                      <Alert className="bg-red-500/10">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <AlertDescription>
                          Rejected on {format(new Date(application.updated_at!), 'MMM d, yyyy')}
                          {application.landlord_notes && <p className="mt-1 text-sm">Reason: {application.landlord_notes}</p>}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this application. This will help the applicant improve future applications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="e.g., We've decided to go with another applicant who better matches our requirements..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRejectApplication}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? 'Rejecting...' : 'Reject Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}