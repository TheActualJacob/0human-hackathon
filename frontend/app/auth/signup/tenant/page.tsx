'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Loader2, ArrowLeft, User, Phone, Briefcase, DollarSign, Home, Calendar, Pets, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { signUpTenant } from '@/lib/auth/client';

export default function TenantSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    whatsappNumber: '',
    
    // Step 2: Profile Information (for screening)
    employmentStatus: '',
    monthlyIncome: '',
    currentEmployer: '',
    employmentDuration: '',
    hasRentalHistory: '',
    currentAddress: '',
    reasonForMoving: '',
    hasPets: '',
    petDetails: '',
    preferredMoveInDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default to 30 days from now
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      // Validate step 1 fields
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }
      setError('');
      setStep(2);
      return;
    }
    
    // Step 2: Submit the form
    if (!agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await signUpTenant({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        whatsappNumber: formData.whatsappNumber,
        profileData: {
          employmentStatus: formData.employmentStatus,
          monthlyIncome: formData.monthlyIncome,
          currentEmployer: formData.currentEmployer,
          employmentDuration: formData.employmentDuration,
          hasRentalHistory: formData.hasRentalHistory === 'yes',
          currentAddress: formData.currentAddress,
          reasonForMoving: formData.reasonForMoving,
          hasPets: formData.hasPets === 'yes',
          petDetails: formData.petDetails,
          preferredMoveInDate: formData.preferredMoveInDate,
          emergencyContactName: formData.emergencyContactName,
          emergencyContactPhone: formData.emergencyContactPhone,
        }
      });
      
      // Redirect to return URL or tenant dashboard
      if (returnUrl) {
        router.push(returnUrl);
      } else {
        router.push('/tenant/dashboard');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-background to-muted/50">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-8">
            <Building2 className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">PropAI</span>
          </Link>
          <h2 className="text-2xl font-bold">Create Your Tenant Account</h2>
          <p className="text-muted-foreground mt-2">
            {step === 1 ? 'Start by creating your account' : 'Complete your profile for better matches'}
          </p>
          
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className={`h-2 w-24 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-24 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card border rounded-xl p-8 shadow-sm">
            {error && (
              <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            {step === 1 ? (
              /* Step 1: Basic Information */
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Account Information
                  </h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={formData.fullName}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="jane@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whatsappNumber">WhatsApp Number *</Label>
                    <Input
                      id="whatsappNumber"
                      name="whatsappNumber"
                      type="tel"
                      required
                      placeholder="+44 7123 456789"
                      value={formData.whatsappNumber}
                      onChange={handleChange}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll use this for quick communication about properties
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 6 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  Continue to Profile
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                </Button>
              </div>
            ) : (
              /* Step 2: Profile Information */
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Profile Information
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>

                {/* Employment Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Employment Details</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="employmentStatus">Employment Status *</Label>
                      <Select
                        value={formData.employmentStatus}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, employmentStatus: value }))}
                      >
                        <SelectTrigger id="employmentStatus">
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

                    <div className="space-y-2">
                      <Label htmlFor="monthlyIncome">Monthly Income (£) *</Label>
                      <Select
                        value={formData.monthlyIncome}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, monthlyIncome: value }))}
                      >
                        <SelectTrigger id="monthlyIncome">
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

                  {(formData.employmentStatus && formData.employmentStatus !== 'unemployed' && formData.employmentStatus !== 'student') && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="currentEmployer">Current Employer</Label>
                        <Input
                          id="currentEmployer"
                          name="currentEmployer"
                          type="text"
                          placeholder="Company name"
                          value={formData.currentEmployer}
                          onChange={handleChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="employmentDuration">How long at current job?</Label>
                        <Select
                          value={formData.employmentDuration}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, employmentDuration: value }))}
                        >
                          <SelectTrigger id="employmentDuration">
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
                  <h4 className="font-medium text-sm text-muted-foreground">Rental History</h4>
                  
                  <div className="space-y-2">
                    <Label>Do you have previous rental history? *</Label>
                    <RadioGroup
                      value={formData.hasRentalHistory}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hasRentalHistory: value }))}
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

                  <div className="space-y-2">
                    <Label htmlFor="currentAddress">Current Address</Label>
                    <Input
                      id="currentAddress"
                      name="currentAddress"
                      type="text"
                      placeholder="Your current address"
                      value={formData.currentAddress}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reasonForMoving">Reason for Moving</Label>
                    <Input
                      id="reasonForMoving"
                      name="reasonForMoving"
                      type="text"
                      placeholder="e.g., Work relocation, need more space"
                      value={formData.reasonForMoving}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Additional Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Additional Information</h4>
                  
                  <div className="space-y-2">
                    <Label>Do you have any pets? *</Label>
                    <RadioGroup
                      value={formData.hasPets}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hasPets: value }))}
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
                    <div className="space-y-2">
                      <Label htmlFor="petDetails">Pet Details</Label>
                      <Input
                        id="petDetails"
                        name="petDetails"
                        type="text"
                        placeholder="e.g., 1 small dog, 2 cats"
                        value={formData.petDetails}
                        onChange={handleChange}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="preferredMoveInDate">Preferred Move-in Date *</Label>
                    <Input
                      id="preferredMoveInDate"
                      name="preferredMoveInDate"
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.preferredMoveInDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Emergency Contact</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactName">Contact Name</Label>
                      <Input
                        id="emergencyContactName"
                        name="emergencyContactName"
                        type="text"
                        placeholder="Emergency contact name"
                        value={formData.emergencyContactName}
                        onChange={handleChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                      <Input
                        id="emergencyContactPhone"
                        name="emergencyContactPhone"
                        type="tel"
                        placeholder="Emergency contact phone"
                        value={formData.emergencyContactPhone}
                        onChange={handleChange}
                      />
                    </div>
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
                        I agree to the terms and conditions and consent to background screening
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Your information will be used for tenant screening and verification purposes
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !agreedToTerms}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center space-y-4 text-sm">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
            <Link href="/" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}