'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, CheckCircle, AlertCircle,
  Upload, FileText, X, Shield, User, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/auth/client';
import type { Database } from '@/lib/supabase/database.types';

type Unit = Database['public']['Tables']['units']['Row'];

interface UploadSlot {
  file: File | null;
  uploading: boolean;
  url: string | null;
  error: string | null;
}

function FileUploadSlot({
  label,
  required,
  hint,
  slot,
  onChange,
}: {
  label: string;
  required: boolean;
  hint: string;
  slot: UploadSlot;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div
        className={`border rounded-lg p-4 flex items-center gap-4 transition-colors ${
          slot.file ? 'border-green-500/50 bg-green-500/5' : 'border-dashed border-border'
        }`}
      >
        {slot.file ? (
          <>
            <FileText className="h-5 w-5 text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{slot.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(slot.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="shrink-0"
            >
              Choose file
            </Button>
          </>
        )}
      </div>
      {slot.error && (
        <p className="text-xs text-destructive">{slot.error}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

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
    fullName: '',
    email: '',
    whatsappNumber: '',
    preferredMoveInDate: '',
    numberOfOccupants: '1',
    note: '',
  });

  const [files, setFiles] = useState({
    bankStatement: null as File | null,
    incomeProof: null as File | null,
    photoId: null as File | null,
  });

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        router.push(`/auth/signup/tenant?returnUrl=/properties/${params.id}/apply`);
        return;
      }
      setUser(currentUser);

      if (currentUser.entity) {
        setFormData(prev => ({
          ...prev,
          fullName: currentUser.entity.full_name || '',
          email: currentUser.email || '',
          whatsappNumber: currentUser.entity.whatsapp_number || '',
        }));
      }

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

      const { data: applications } = await supabase
        .from('property_applications')
        .select('*')
        .eq('unit_id', params.id)
        .eq('tenant_id', currentUser.entityId);

      if (applications && applications.length > 0) {
        setExistingApplication(applications[0]);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load application data');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, fieldName: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${user.entityId}/${Date.now()}-${fieldName}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('application-documents')
      .upload(path, file);
    if (uploadError) throw uploadError;
    return supabase.storage.from('application-documents').getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      setError('Please agree to the terms and conditions');
      return;
    }
    if (!files.bankStatement) {
      setError('Please upload your bank statement');
      return;
    }
    if (!files.incomeProof) {
      setError('Please upload your proof of income');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Upload documents first
      const bankStatementUrl = await uploadFile(files.bankStatement, 'bankstatement');
      const incomeProofUrl = await uploadFile(files.incomeProof, 'incomeproof');
      const photoIdUrl = files.photoId ? await uploadFile(files.photoId, 'photoid') : null;

      const applicationData = {
        unit_id: params.id,
        tenant_id: user.entityId,
        applicant_data: {
          fullName: formData.fullName,
          email: formData.email,
          whatsappNumber: formData.whatsappNumber,
          preferredMoveInDate: formData.preferredMoveInDate,
          numberOfOccupants: formData.numberOfOccupants,
          note: formData.note,
          documents: {
            bankStatement: bankStatementUrl,
            incomeProof: incomeProofUrl,
            photoId: photoIdUrl,
          },
          submittedAt: new Date().toISOString(),
        },
        status: 'pending' as const,
      };

      const { error: insertError } = await supabase
        .from('property_applications')
        .insert(applicationData)
        .select()
        .single();

      if (insertError) throw insertError;

      setSuccess(true);
    } catch (err: any) {
      console.error('Application error:', err);
      setError(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Loading / error / existing / success states ---

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
                existingApplication.status === 'accepted' ? 'default' :
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
            <p>Your application and documents have been submitted for review.</p>
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

  // --- Main form ---

  return (
    <div className="p-8 max-w-5xl">
      {/* Back link */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
          <Link href={`/properties/${params.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to property
          </Link>
        </Button>
        <h1 className="text-2xl font-bold mt-3">Rental Application</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {property?.unit_identifier} &mdash; {property?.address}, {property?.city}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* ── Application Form ── */}
        <div className="lg:col-span-2 space-y-6">

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Personal details section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Your Details
              </CardTitle>
              <CardDescription>Pre-filled from your account — contact support to update.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={formData.fullName} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
                  <Input id="whatsappNumber" value={formData.whatsappNumber} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="numberOfOccupants">Number of Occupants *</Label>
                  <Select
                    value={formData.numberOfOccupants}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, numberOfOccupants: value }))}
                  >
                    <SelectTrigger id="numberOfOccupants">
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

              <div className="space-y-1.5">
                <Label htmlFor="preferredMoveInDate">Preferred Move-in Date *</Label>
                <Input
                  id="preferredMoveInDate"
                  type="date"
                  value={formData.preferredMoveInDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, preferredMoveInDate: e.target.value }))}
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="note">Note to Landlord <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Textarea
                  id="note"
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  rows={4}
                  placeholder="Introduce yourself or mention anything relevant about your situation..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Documents section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Supporting Documents
              </CardTitle>
              <CardDescription>PDF, JPG, or PNG — max 10 MB per file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FileUploadSlot
                label="Bank Statement"
                required={true}
                hint="Last 3 months — shows regular income and spending"
                slot={{ file: files.bankStatement, uploading: false, url: null, error: null }}
                onChange={(file) => setFiles(prev => ({ ...prev, bankStatement: file }))}
              />
              <FileUploadSlot
                label="Proof of Income"
                required={true}
                hint="Recent payslip, employment letter, or tax return"
                slot={{ file: files.incomeProof, uploading: false, url: null, error: null }}
                onChange={(file) => setFiles(prev => ({ ...prev, incomeProof: file }))}
              />
              <FileUploadSlot
                label="Photo ID"
                required={false}
                hint="Passport or national ID (optional but recommended)"
                slot={{ file: files.photoId, uploading: false, url: null, error: null }}
                onChange={(file) => setFiles(prev => ({ ...prev, photoId: file }))}
              />
            </CardContent>
          </Card>

          {/* Terms + submit */}
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="terms" className="font-medium cursor-pointer">
                    I agree to the terms and conditions
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I consent to background and reference checks and certify that all information provided is accurate and complete.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting || !agreedToTerms}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading &amp; Submitting…
                  </>
                ) : (
                  'Submit Application'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Property Summary sidebar ── */}
        <div className="space-y-5">
          <Card className="sticky top-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Property Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-0.5">
                <p className="font-semibold">{property?.unit_identifier}</p>
                <p className="text-sm text-muted-foreground">{property?.address}, {property?.city}</p>
              </div>

              <div className="border-t border-border pt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="font-semibold">€{property?.rent_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security Deposit</span>
                  <span className="font-semibold">€{(property?.security_deposit || property?.rent_amount)?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-semibold">
                    {property?.available_date
                      ? new Date(property.available_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'Immediately'}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  <span>Documents encrypted &amp; securely stored</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Landlord reviews within 2–3 business days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
