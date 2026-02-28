'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpTenant, validateInviteCode } from '@/lib/auth/client';

export default function TenantSignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  const [error, setError] = useState('');
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    whatsappNumber: '',
    inviteCode: ''
  });

  // Validate invite code when it changes
  useEffect(() => {
    const validateCode = async () => {
      if (formData.inviteCode.length >= 8) {
        setValidatingCode(true);
        const result = await validateInviteCode(formData.inviteCode);
        setInviteValid(result.valid);
        if (result.valid && result.invite) {
          setInviteDetails(result);
          // Pre-fill email if invite has one
          if (result.invite.email) {
            setFormData(prev => ({ ...prev, email: result.invite.email }));
          }
        } else {
          setInviteDetails(null);
          setError(result.message || 'Invalid invite code');
        }
        setValidatingCode(false);
      } else {
        setInviteValid(null);
        setInviteDetails(null);
      }
    };

    validateCode();
  }, [formData.inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    // Validate invite code
    if (!inviteValid) {
      setError('Please enter a valid invite code');
      setLoading(false);
      return;
    }

    try {
      await signUpTenant({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        whatsappNumber: formData.whatsappNumber,
        inviteCode: formData.inviteCode
      });
      
      // Redirect to tenant dashboard
      router.push('/tenant/dashboard');
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-background to-muted/50">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-2 mb-8">
            <Building2 className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">PropAI</span>
          </Link>
          <h2 className="text-2xl font-bold">Create Tenant Account</h2>
          <p className="text-muted-foreground mt-2">
            Join your landlord's property on PropAI
          </p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Invite Code - First */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code *</Label>
                <div className="relative">
                  <Input
                    id="inviteCode"
                    name="inviteCode"
                    type="text"
                    required
                    placeholder="ABCD1234"
                    value={formData.inviteCode}
                    onChange={handleChange}
                    disabled={loading}
                    className="uppercase"
                  />
                  {validatingCode && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!validatingCode && inviteValid === true && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                  )}
                  {!validatingCode && inviteValid === false && formData.inviteCode.length >= 8 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the 8-character code from your landlord
                </p>
              </div>

              {/* Show property details if invite is valid */}
              {inviteDetails && inviteDetails.unit && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium mb-1">Property Details</p>
                  <p className="text-sm text-muted-foreground">
                    {inviteDetails.unit.name} - {inviteDetails.unit.address}
                  </p>
                  {inviteDetails.lease && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Lease: {new Date(inviteDetails.lease.start_date).toLocaleDateString()} - 
                      {new Date(inviteDetails.lease.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Account Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-sm text-muted-foreground">Account Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={loading || !inviteValid}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="jane@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading || !inviteValid || !!inviteDetails?.invite?.email}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">WhatsApp Number *</Label>
                <Input
                  id="whatsappNumber"
                  name="whatsappNumber"
                  type="tel"
                  required
                  placeholder="+1 (555) 123-4567"
                  value={formData.whatsappNumber}
                  onChange={handleChange}
                  disabled={loading || !inviteValid}
                />
                <p className="text-xs text-muted-foreground">
                  For maintenance requests and updates
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
                  disabled={loading || !inviteValid}
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
                  disabled={loading || !inviteValid}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !inviteValid}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Tenant Account'
              )}
            </Button>
          </div>

          {/* Footer */}
          <div className="text-center space-y-4 text-sm">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
            <p className="text-muted-foreground">
              Don't have an invite code?{' '}
              <Link href="/contact" className="text-primary hover:underline">
                Contact your landlord
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