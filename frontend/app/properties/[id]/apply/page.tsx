'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Loader2, CheckCircle, AlertCircle,
  User, Briefcase, Home, Calendar, Pets, Phone,
  FileText, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/client';
import type { Database } from '@/lib/supabase/database.types';

type Unit = Database['public']['Tables']['units']['Row'];

export default function PropertyApplicationPage() {
  const router = useRouter();
  const rawParams = useParams();
  const params = { id: rawParams?.id as string };
  const supabase = createClient();
  
  const [property, setProperty] = useState<Unit | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [formData, setFormData] = useState({
    // Pre-filled from user profile
    fullName: '',
    email: '',
    whatsappNumber: '',
    
    // Employment Details
    employmentStatus: '',
    monthlyIncome: '',
    currentEmployer: '',
    employmentDuration: '',
    
    // Rental History
    hasRentalHistory: '',
    currentAddress: '',
    reasonForMoving: '',
    previousLandlordContact: '',
    
    // Additional Information
    hasPets: '',
    petDetails: '',
    preferredMoveInDate: '',
    numberOfOccupants: '1',
    emergencyContactName: '',
    emergencyContactPhone: '',
    
    // Cover Letter
    coverLetter: ''
  });

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      // Get current user
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push(`/auth/signup/tenant?returnUrl=/properties/${params.id}/apply`);
        return;
      }
      setUser(currentUser);

      // Pre-fill form with user data
      if (currentUser.entity) {
        setFormData(prev => ({
          ...prev,
          fullName: currentUser.entity.full_name || '',
          email: currentUser.email || '',
          whatsappNumber: currentUser.entity.whatsapp_number || '',
          // Pre-fill from profile_data if available
          ...(currentUser.entity.profile_data || {})
        }));
      }

      // Load property details
      const { data: propertyData, error: propertyError } = await supabase
        .from('units')
        .select('*')
        .eq('id', params.id)
        .or('listing_status.eq.public,listing_status.is.null')
        .single();

      if (propertyError || !propertyData) {
        setError('Property not found or no longer available');
        return;
      }

      setProperty(propertyData);

      // Check if user already applied
      const { data: applications } = await supabase
        .from('property_applications')
        .select('*')
        .eq('unit_id', params.id)
        .eq('tenant_id', currentUser.entityId);

      if (applications && applications.length > 0) {
        setExistingApplication(applications[0]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load application data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const applicationData = {
        unit_id: params.id,
        tenant_id: user.entityId,
        applicant_data: {
          ...formData,
          submittedAt: new Date().toISOString()
        },
        status: 'pending' as const
      };

      const { data, error } = await supabase
        .from('property_applications')
        .insert(applicationData)
        .select()
        .single();

      if (error) throw error;

      // Trigger AI screening in the background
      // In a real app, this would be a server-side function
      setTimeout(async () => {
        try {
          const { screenTenantWithClaude } = await import('@/lib/ai/tenant-screening');
          await screenTenantWithClaude(
            formData as any,
            {
              rentAmount: property?.rent_amount || 0,
              securityDeposit: property?.security_deposit || 0,
              availableDate: property?.available_date || ''
            }
          );
        } catch (error) {
          console.error('Screening error:', error);
        }
      }, 1000);

      setSuccess(true);
    } catch (error: any) {
      console.error('Application error:', error);
      setError(error.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error && !property) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="ghost" asChild className="mt-4">
          <Link href="/properties">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to listings
          </Link>
        </Button>
      </div>
    );
  }

  if (existingApplication) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Application Already Submitted
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>You have already applied for this property.</p>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-1">Application Status</p>
              <Badge variant={
                existingApplication.status === 'accepted' ? 'success' :
                existingApplication.status === 'rejected' ? 'destructive' :
                'secondary'
              }>
                {existingApplication.status.toUpperCase()}
              </Badge>
            </div>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/tenant/applications">View My Applications</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/properties">Browse More Properties</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Application Submitted Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Your application has been submitted and is being reviewed by our AI screening system.</p>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                The landlord will review your application and contact you within 2-3 business days.
              </AlertDescription>
            </Alert>
            <div className="flex gap-4">
              <Button asChild>
                <Link href="/tenant/applications">View My Applications</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/properties">Browse More Properties</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href={`/properties/${params.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to property
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Application Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Rental Application</CardTitle>
              <CardDescription>
                Complete all fields to help us process your application quickly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        required
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        disabled
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="whatsappNumber">WhatsApp Number *</Label>
                      <Input
                        id="whatsappNumber"
                        name="whatsappNumber"
                        value={formData.whatsappNumber}
                        onChange={handleChange}
                        required
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="numberOfOccupants">Number of Occupants *</Label>
                      <Select
                        value={formData.numberOfOccupants}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, numberOfOccupants: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Person</SelectItem>
                          <SelectItem value="2">2 People</SelectItem>
                          <SelectItem value="3">3 People</SelectItem>
                          <SelectItem value="4">4 People</SelectItem>
                          <SelectItem value="5">5+ People</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Employment Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Employment Information
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="employmentStatus">Employment Status *</Label>
                      <Select
                        value={formData.employmentStatus}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_time">Full-time Employed</SelectItem>
                          <SelectItem value="part_time">Part-time Employed</SelectItem>
                          <SelectItem value="self_employed">Self Employed</SelectItem>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                          <SelectItem value="unemployed">Unemployed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="monthlyIncome">Monthly Income *</Label>
                      <Select
                        value={formData.monthlyIncome}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, monthlyIncome: value }))}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0-1000">Under £1,000</SelectItem>
                          <SelectItem value="1000-2000">£1,000 - £2,000</SelectItem>
                          <SelectItem value="2000-3000">£2,000 - £3,000</SelectItem>
                          <SelectItem value="3000-4000">£3,000 - £4,000</SelectItem>
                          <SelectItem value="4000-5000">£4,000 - £5,000</SelectItem>
                          <SelectItem value="5000+">£5,000+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {(formData.employmentStatus && formData.employmentStatus !== 'unemployed') && (
                    <>
                      <div>
                        <Label htmlFor="currentEmployer">Current Employer</Label>
                        <Input
                          id="currentEmployer"
                          name="currentEmployer"
                          value={formData.currentEmployer}
                          onChange={handleChange}
                          placeholder="Company name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="employmentDuration">Employment Duration</Label>
                        <Select
                          value={formData.employmentDuration}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, employmentDuration: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="less_6_months">Less than 6 months</SelectItem>
                            <SelectItem value="6_12_months">6-12 months</SelectItem>
                            <SelectItem value="1_2_years">1-2 years</SelectItem>
                            <SelectItem value="2_5_years">2-5 years</SelectItem>
                            <SelectItem value="5_years_plus">5+ years</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {/* Rental History */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Rental History
                  </h3>
                  
                  <div>
                    <Label>Do you have previous rental history? *</Label>
                    <RadioGroup
                      value={formData.hasRentalHistory}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hasRentalHistory: value }))}
                      required
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="rental-yes" />
                        <Label htmlFor="rental-yes">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="rental-no" />
                        <Label htmlFor="rental-no">No (First-time renter)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="currentAddress">Current Address *</Label>
                    <Textarea
                      id="currentAddress"
                      name="currentAddress"
                      value={formData.currentAddress}
                      onChange={handleChange}
                      required
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="reasonForMoving">Reason for Moving *</Label>
                    <Input
                      id="reasonForMoving"
                      name="reasonForMoving"
                      value={formData.reasonForMoving}
                      onChange={handleChange}
                      required
                      placeholder="e.g., Work relocation, need more space"
                    />
                  </div>

                  {formData.hasRentalHistory === 'yes' && (
                    <div>
                      <Label htmlFor="previousLandlordContact">Previous Landlord Contact (Optional)</Label>
                      <Input
                        id="previousLandlordContact"
                        name="previousLandlordContact"
                        value={formData.previousLandlordContact}
                        onChange={handleChange}
                        placeholder="Name and phone/email"
                      />
                    </div>
                  )}
                </div>

                {/* Additional Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Additional Information
                  </h3>

                  <div>
                    <Label htmlFor="preferredMoveInDate">Preferred Move-in Date *</Label>
                    <Input
                      id="preferredMoveInDate"
                      name="preferredMoveInDate"
                      type="date"
                      value={formData.preferredMoveInDate}
                      onChange={handleChange}
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div>
                    <Label>Do you have any pets? *</Label>
                    <RadioGroup
                      value={formData.hasPets}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hasPets: value }))}
                      required
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="pets-no" />
                        <Label htmlFor="pets-no">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="pets-yes" />
                        <Label htmlFor="pets-yes">Yes</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {formData.hasPets === 'yes' && (
                    <div>
                      <Label htmlFor="petDetails">Pet Details *</Label>
                      <Input
                        id="petDetails"
                        name="petDetails"
                        value={formData.petDetails}
                        onChange={handleChange}
                        required
                        placeholder="e.g., 1 small dog, 2 cats"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                      <Input
                        id="emergencyContactName"
                        name="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                      <Input
                        id="emergencyContactPhone"
                        name="emergencyContactPhone"
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="coverLetter">Cover Letter (Optional)</Label>
                    <Textarea
                      id="coverLetter"
                      name="coverLetter"
                      value={formData.coverLetter}
                      onChange={handleChange}
                      rows={4}
                      placeholder="Tell the landlord why you'd be a great tenant..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This is your chance to stand out from other applicants
                    </p>
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-4">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                        I agree to the terms and conditions
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        I consent to background and credit checks, and certify that all information provided is accurate.
                        I understand that providing false information may result in rejection of my application.
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitting || !agreedToTerms}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Property Summary */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Property Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{property?.unit_identifier}</p>
                <p className="text-sm text-muted-foreground">{property?.address}, {property?.city}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="font-medium">£{property?.rent_amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security Deposit</span>
                  <span className="font-medium">£{property?.security_deposit || property?.rent_amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-medium">
                    {property?.available_date ? new Date(property.available_date).toLocaleDateString() : 'Immediately'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your application will be screened by our AI system for a fair and unbiased review.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}

// Add missing Badge import
import { Badge } from '@/components/ui/badge';