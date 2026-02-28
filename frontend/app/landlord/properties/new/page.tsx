'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, DollarSign, Calendar, FileText, Sparkles, Eye, EyeOff, Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import useLandlordStore from '@/lib/store/landlord';
import { createClient } from '@/lib/supabase/client';
import { createPropertyInvite } from '@/lib/property/invites';
import { getCurrentUser } from '@/lib/auth/client';
import Link from 'next/link';

export default function NewPropertyPage() {
  const router = useRouter();
  const { createUnit } = useLandlordStore();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const [formData, setFormData] = useState({
    // Basic Details
    unit_identifier: '',
    address: '',
    city: '',
    country: 'GB',
    jurisdiction: 'england_wales',
    
    // Listing Details
    listing_status: 'not_listed' as 'not_listed' | 'public' | 'private',
    listing_description: '',
    rent_amount: '',
    security_deposit: '',
    available_date: new Date().toISOString().split('T')[0],
    
    // Property Attributes (for AI description generation)
    bedrooms: '',
    bathrooms: '',
    furnished_status: '',
    has_parking: false,
    has_garden_access: false,
    has_balcony: false,
  });
  
  // Private listing invite emails
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get current user
      const user = await getCurrentUser();
      if (!user) throw new Error('You must be logged in');

      // Create the unit with listing details
      const unitData = {
        unit_identifier: formData.unit_identifier,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        jurisdiction: formData.jurisdiction,
        listing_status: formData.listing_status,
        listing_description: formData.listing_description || null,
        rent_amount: formData.rent_amount ? parseFloat(formData.rent_amount) : null,
        security_deposit: formData.security_deposit ? parseFloat(formData.security_deposit) : null,
        available_date: formData.available_date || null,
        listing_created_at: formData.listing_status !== 'not_listed' ? new Date().toISOString() : null,
      };

      const createdUnit = await createUnit(unitData);

      // If private listing, send invites to specified emails
      if (formData.listing_status === 'private' && inviteEmails.length > 0 && createdUnit?.id) {
        const invitePromises = inviteEmails.map(email => 
          createPropertyInvite({
            unitId: createdUnit.id,
            landlordId: user.entityId,
            email,
            message: `You've been invited to view ${formData.unit_identifier} at ${formData.address}, ${formData.city}.`
          })
        );
        
        await Promise.all(invitePromises);
      }
      
      router.push('/landlord/properties');
    } catch (err: any) {
      const msg = err?.message || String(err) || 'Failed to create property';
      console.error('Error creating property:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const generateDescription = async () => {
    if (!formData.bedrooms || !formData.address || !formData.rent_amount) {
      setError('Please fill in bedrooms, address, and rent amount before generating description');
      return;
    }

    setGeneratingDescription(true);
    setError(null);

    try {
      // TODO: Implement Claude AI integration for description generation
      // For now, use a template-based approach
      const features = [];
      if (formData.has_parking) features.push('private parking');
      if (formData.has_garden_access) features.push('garden access');
      if (formData.has_balcony) features.push('balcony');
      
      const description = `Beautiful ${formData.bedrooms} bedroom property located in ${formData.city}.

This ${formData.furnished_status || 'unfurnished'} property features ${formData.bedrooms} bedroom${formData.bedrooms !== '1' ? 's' : ''} and ${formData.bathrooms || '1'} bathroom${formData.bathrooms !== '1' ? 's' : ''}.${features.length > 0 ? ` Additional features include ${features.join(', ')}.` : ''}

Located at ${formData.address}, this property offers excellent transport links and local amenities.

Available from ${new Date(formData.available_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.

Monthly rent: £${formData.rent_amount}
Security deposit: £${formData.security_deposit || formData.rent_amount}

Contact us today to arrange a viewing.`;

      setFormData({ ...formData, listing_description: description });
    } catch (err) {
      console.error('Error generating description:', err);
      setError('Failed to generate description');
    } finally {
      setGeneratingDescription(false);
    }
  };

  if (previewMode) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setPreviewMode(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to editing
          </Button>
          <Badge variant="secondary">Preview Mode</Badge>
        </div>
        
        {/* Preview of how the listing will appear */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{formData.unit_identifier}</CardTitle>
            <p className="text-muted-foreground">{formData.address}, {formData.city}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">£{formData.rent_amount}/month</div>
            <p className="whitespace-pre-wrap">{formData.listing_description}</p>
            <div className="flex gap-4 text-sm">
              <span>Available from {new Date(formData.available_date).toLocaleDateString()}</span>
              <span>Deposit: £{formData.security_deposit}</span>
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
          <Link href="/landlord/properties">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to properties
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Property Details */}
        <Card>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
            <CardDescription>Basic information about your property</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_identifier">Property Name/Number</Label>
                <Input
                  id="unit_identifier"
                  required
                  placeholder="e.g., Flat 3, Unit B"
                  value={formData.unit_identifier}
                  onChange={(e) => setFormData({ ...formData, unit_identifier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  required
                  placeholder="e.g., London"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Full Address</Label>
              <Input
                id="address"
                required
                placeholder="e.g., 123 Main Street, SW1A 1AA"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Select
                  value={formData.bedrooms}
                  onValueChange={(value) => setFormData({ ...formData, bedrooms: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bedrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Studio</SelectItem>
                    <SelectItem value="1">1 Bedroom</SelectItem>
                    <SelectItem value="2">2 Bedrooms</SelectItem>
                    <SelectItem value="3">3 Bedrooms</SelectItem>
                    <SelectItem value="4">4 Bedrooms</SelectItem>
                    <SelectItem value="5">5+ Bedrooms</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Select
                  value={formData.bathrooms}
                  onValueChange={(value) => setFormData({ ...formData, bathrooms: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bathrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Bathroom</SelectItem>
                    <SelectItem value="2">2 Bathrooms</SelectItem>
                    <SelectItem value="3">3 Bathrooms</SelectItem>
                    <SelectItem value="4">4+ Bathrooms</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listing Options */}
        <Card>
          <CardHeader>
            <CardTitle>Listing Options</CardTitle>
            <CardDescription>Choose how you want to list this property</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="listing_status">Listing Type</Label>
              <Select
                value={formData.listing_status}
                onValueChange={(value: any) => setFormData({ ...formData, listing_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_listed">
                    <div>
                      <div className="font-medium">Not Listed</div>
                      <div className="text-xs text-muted-foreground">Keep property private, no listings</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="public">
                    <div>
                      <div className="font-medium">Public Listing</div>
                      <div className="text-xs text-muted-foreground">Visible to all prospective tenants</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div>
                      <div className="font-medium">Private Listing</div>
                      <div className="text-xs text-muted-foreground">Only accessible via email invitation</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.listing_status === 'public' || formData.listing_status === 'private') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rent_amount">Monthly Rent (£)</Label>
                    <Input
                      id="rent_amount"
                      type="number"
                      required
                      placeholder="1500"
                      value={formData.rent_amount}
                      onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security_deposit">Security Deposit (£)</Label>
                    <Input
                      id="security_deposit"
                      type="number"
                      placeholder="1500"
                      value={formData.security_deposit}
                      onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="available_date">Available From</Label>
                  <Input
                    id="available_date"
                    type="date"
                    required
                    value={formData.available_date}
                    onChange={(e) => setFormData({ ...formData, available_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="furnished_status">Furnishing Status</Label>
                  <Select
                    value={formData.furnished_status}
                    onValueChange={(value) => setFormData({ ...formData, furnished_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select furnishing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unfurnished">Unfurnished</SelectItem>
                      <SelectItem value="part_furnished">Part Furnished</SelectItem>
                      <SelectItem value="fully_furnished">Fully Furnished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Additional Features</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.has_parking}
                        onCheckedChange={(checked) => setFormData({ ...formData, has_parking: checked })}
                      />
                      <Label>Parking Available</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.has_garden_access}
                        onCheckedChange={(checked) => setFormData({ ...formData, has_garden_access: checked })}
                      />
                      <Label>Garden Access</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.has_balcony}
                        onCheckedChange={(checked) => setFormData({ ...formData, has_balcony: checked })}
                      />
                      <Label>Balcony</Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="listing_description">Property Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateDescription}
                      disabled={generatingDescription}
                    >
                      {generatingDescription ? (
                        <>Generating...</>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          AI Generate
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    id="listing_description"
                    placeholder="Describe your property..."
                    rows={6}
                    value={formData.listing_description}
                    onChange={(e) => setFormData({ ...formData, listing_description: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This description will be shown to prospective tenants
                  </p>
                </div>
                
                {/* Private Listing Email Invites */}
                {formData.listing_status === 'private' && (
                  <div className="space-y-2">
                    <Label>Invite Specific Tenants</Label>
                    <p className="text-sm text-muted-foreground">
                      Add email addresses of tenants you want to invite to view this property
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="tenant@example.com"
                          value={currentEmail}
                          onChange={(e) => setCurrentEmail(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && currentEmail.includes('@')) {
                              e.preventDefault();
                              if (!inviteEmails.includes(currentEmail)) {
                                setInviteEmails([...inviteEmails, currentEmail]);
                                setCurrentEmail('');
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (currentEmail.includes('@') && !inviteEmails.includes(currentEmail)) {
                              setInviteEmails([...inviteEmails, currentEmail]);
                              setCurrentEmail('');
                            }
                          }}
                          disabled={!currentEmail.includes('@') || inviteEmails.includes(currentEmail)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {inviteEmails.length > 0 && (
                        <div className="space-y-1">
                          {inviteEmails.map((email, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm bg-muted px-3 py-1 rounded-md">
                              <Mail className="h-3 w-3" />
                              <span className="flex-1">{email}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setInviteEmails(inviteEmails.filter((_, i) => i !== index));
                                }}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Creating Property...' : 'Create Property'}
          </Button>
          
          {(formData.listing_status === 'public' || formData.listing_status === 'private') && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewMode(true)}
              disabled={!formData.listing_description}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Listing
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

// Add missing Badge import
import { Badge } from '@/components/ui/badge';