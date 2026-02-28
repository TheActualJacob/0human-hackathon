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
  FileText, MapPin, Calendar, DollarSign, User,
  Clock, CheckCircle, XCircle, AlertCircle, Brain,
  Home, Phone, Briefcase, TrendingUp, TrendingDown,
  Shield, MessageSquare, Mail, ChevronRight
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
  const [activeTab, setActiveTab] = useState('all');
  
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

      // TODO: Send acceptance notification to tenant

      await loadApplications();
      alert('Application accepted! The tenant will be notified.');
    } catch (err) {
      console.error('Error accepting application:', err);
      alert('Failed to accept application');
    } finally {
      setProcessing(false);
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

      // TODO: Send rejection notification to tenant

      await loadApplications();
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedApplication(null);
    } catch (err) {
      console.error('Error rejecting application:', err);
      alert('Failed to reject application');
    } finally {
      setProcessing(false);
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

  const getScoreIndicator = (score: number | null) => {
    if (!score) return null;
    
    const percentage = Math.round(score * 100);
    const Icon = percentage >= 75 ? TrendingUp : percentage >= 50 ? ChevronRight : TrendingDown;
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
      <div className="space-y-6">
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
    <div className="space-y-6">
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
            filteredApplications.map((application) => (
              <Card key={application.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {application.tenants?.full_name || 'Unknown Applicant'}
                      </CardTitle>
                      <CardDescription className="space-y-1 mt-2">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {application.units?.unit_identifier}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {application.units?.address}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {application.tenants?.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {application.tenants?.whatsapp_number}
                          </span>
                        </div>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(application.status || 'pending')}
                      {application.ai_screening_score !== null && (
                        <div className="text-sm">
                          AI Score: {getScoreIndicator(application.ai_screening_score)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Application Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Applied</p>
                      <p className="font-medium">
                        {formatDistanceToNow(new Date(application.created_at!), { addSuffix: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Income</p>
                      <p className="font-medium">
                        {application.applicant_data?.monthlyIncome || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Employment</p>
                      <p className="font-medium">
                        {application.applicant_data?.employmentStatus?.replace(/_/g, ' ') || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Move-in Date</p>
                      <p className="font-medium">
                        {application.applicant_data?.preferredMoveInDate 
                          ? format(new Date(application.applicant_data.preferredMoveInDate), 'MMM d, yyyy')
                          : 'ASAP'}
                      </p>
                    </div>
                  </div>

                  {/* AI Screening Results */}
                  {application.ai_screening_result && (
                    <Alert className="bg-primary/5">
                      <Brain className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">AI Screening Summary</p>
                            {application.ai_screening_result.details?.aiProvider && (
                              <Badge variant="outline" className="text-xs">
                                {application.ai_screening_result.details.aiProvider === 'claude-3-sonnet' ? 'Claude AI' : 'Rule-based'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{application.ai_screening_result.summary}</p>
                          
                          {/* Risk Factors */}
                          {application.ai_screening_result.details?.riskFactors && (
                            <div className="flex gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Financial:</span>
                                <Badge 
                                  variant={
                                    application.ai_screening_result.details.riskFactors.financialRisk === 'low' ? 'default' :
                                    application.ai_screening_result.details.riskFactors.financialRisk === 'medium' ? 'secondary' : 'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {application.ai_screening_result.details.riskFactors.financialRisk}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Stability:</span>
                                <Badge 
                                  variant={
                                    application.ai_screening_result.details.riskFactors.stabilityRisk === 'low' ? 'default' :
                                    application.ai_screening_result.details.riskFactors.stabilityRisk === 'medium' ? 'secondary' : 'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {application.ai_screening_result.details.riskFactors.stabilityRisk}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Property:</span>
                                <Badge 
                                  variant={
                                    application.ai_screening_result.details.riskFactors.propertyRisk === 'low' ? 'default' :
                                    application.ai_screening_result.details.riskFactors.propertyRisk === 'medium' ? 'secondary' : 'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {application.ai_screening_result.details.riskFactors.propertyRisk}
                                </Badge>
                              </div>
                            </div>
                          )}
                          
                          {application.ai_screening_result.strengths?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-green-600">Strengths:</p>
                              <ul className="text-sm list-disc list-inside">
                                {application.ai_screening_result.strengths.map((strength: string, i: number) => (
                                  <li key={i}>{strength}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {application.ai_screening_result.concerns?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-yellow-600">Concerns:</p>
                              <ul className="text-sm list-disc list-inside">
                                {application.ai_screening_result.concerns.map((concern: string, i: number) => (
                                  <li key={i}>{concern}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Verification Needed */}
                          {application.ai_screening_result.details?.verificationNeeded?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-blue-600">Verification Required:</p>
                              <ul className="text-sm list-disc list-inside">
                                {application.ai_screening_result.details.verificationNeeded.map((item: string, i: number) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Additional Insights */}
                          {application.ai_screening_result.details?.additionalInsights && (
                            <div className="bg-muted/50 p-3 rounded text-sm">
                              <p className="font-medium mb-1">Additional Insights:</p>
                              <p>{application.ai_screening_result.details.additionalInsights}</p>
                            </div>
                          )}
                          
                          {/* Suggested Questions */}
                          {application.ai_screening_result.details?.suggestedQuestions?.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-purple-600">Suggested Follow-up Questions:</p>
                              <ul className="text-sm list-disc list-inside">
                                {application.ai_screening_result.details.suggestedQuestions.map((question: string, i: number) => (
                                  <li key={i}>{question}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Cover Letter */}
                  {application.applicant_data?.coverLetter && (
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Cover Letter
                      </p>
                      <p className="text-sm">{application.applicant_data.coverLetter}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {['pending', 'ai_screening', 'under_review'].includes(application.status || '') && (
                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm"
                        onClick={() => handleAcceptApplication(application)}
                        disabled={processing}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept Application
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedApplication(application);
                          setShowRejectDialog(true);
                        }}
                        disabled={processing}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // TODO: Implement view full application
                          alert('View full application coming soon');
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  )}

                  {application.status === 'accepted' && (
                    <Alert className="bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription>
                        Application accepted on {format(new Date(application.updated_at!), 'MMM d, yyyy')}
                      </AlertDescription>
                    </Alert>
                  )}

                  {application.status === 'rejected' && (
                    <Alert className="bg-red-500/10">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <AlertDescription>
                        Application rejected on {format(new Date(application.updated_at!), 'MMM d, yyyy')}
                        {application.landlord_notes && (
                          <p className="mt-1 text-sm">Reason: {application.landlord_notes}</p>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))
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