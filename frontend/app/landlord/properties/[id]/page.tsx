'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Save, Trash2, Upload, X, Plus, Image as ImageIcon,
  MapPin, Home, Bed, Bath, DollarSign, Calendar, FileText,
  Loader2, AlertCircle, Check, Camera
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { createClient } from '@/lib/supabase/client';
import useAuthStore from '@/lib/store/auth';
import useLandlordStore from '@/lib/store/landlord';
import { format } from 'date-fns';

interface PropertyFormData {
  unit_identifier: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  square_footage?: number;
  rent_amount?: number;
  security_deposit?: number;
  available_date?: string;
  listing_status: 'not_listed' | 'public' | 'private';
  listing_description?: string;
  features: {
    has_parking: boolean;
    has_garden_access: boolean;
    has_balcony: boolean;
    has_lift: boolean;
    pet_policy: 'allowed' | 'not_allowed' | 'case_by_case';
    furnished_status: 'furnished' | 'unfurnished' | 'partially_furnished';
  };
  images: string[];
}

export default function PropertyEditPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { units, fetchLandlordData, deleteUnit } = useLandlordStore();
  
  const propertyId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [formData, setFormData] = useState<PropertyFormData>({
    unit_identifier: '',
    address: '',
    city: '',
    postcode: '',
    country: 'UK',
    unit_type: 'apartment',
    bedrooms: 1,
    bathrooms: 1,
    square_footage: undefined,
    rent_amount: undefined,
    security_deposit: undefined,
    available_date: '',
    listing_status: 'not_listed',
    listing_description: '',
    features: {
      has_parking: false,
      has_garden_access: false,
      has_balcony: false,
      has_lift: false,
      pet_policy: 'case_by_case',
      furnished_status: 'unfurnished'
    },
    images: []
  });

  // Load property data
  useEffect(() => {
    async function loadPropertyData() {
      if (!user?.entityId || !propertyId) return;

      setLoading(true);
      try {
        const supabase = createClient();
        
        // Fetch unit details
        const { data: unit, error } = await supabase
          .from('units')
          .select('*')
          .eq('id', propertyId)
          .eq('landlord_id', user.entityId)
          .single();

        if (error || !unit) {
          console.error('Error loading property:', error);
          router.push('/landlord/properties');
          return;
        }

        // Fetch unit attributes
        const { data: attributes } = await supabase
          .from('unit_attributes')
          .select('*')
          .eq('unit_id', propertyId)
          .single();

        // Set form data
        setFormData({
          unit_identifier: unit.unit_identifier || '',
          address: unit.address || '',
          city: unit.city || '',
          postcode: unit.postcode || '',
          country: unit.country || 'UK',
          unit_type: unit.unit_type || 'apartment',
          bedrooms: unit.bedrooms || attributes?.bedrooms || 1,
          bathrooms: unit.bathrooms || attributes?.bathrooms || 1,
          square_footage: unit.square_footage || attributes?.square_footage || undefined,
          rent_amount: unit.rent_amount || undefined,
          security_deposit: unit.security_deposit || undefined,
          available_date: unit.available_date || '',
          listing_status: unit.listing_status || 'not_listed',
          listing_description: unit.listing_description || '',
          features: {
            has_parking: attributes?.has_parking || false,
            has_garden_access: attributes?.has_garden_access || false,
            has_balcony: attributes?.has_balcony || false,
            has_lift: attributes?.has_lift || false,
            pet_policy: attributes?.pet_policy || 'case_by_case',
            furnished_status: attributes?.furnished_status || 'unfurnished'
          },
          images: unit.images || []
        });
      } catch (error) {
        console.error('Error loading property:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPropertyData();
  }, [propertyId, user?.entityId, router]);

  // Handle form changes
  const handleChange = (field: keyof PropertyFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFeatureChange = (feature: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: value
      }
    }));
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const supabase = createClient();
      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${propertyId}/${Date.now()}-${Math.random()}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('property-images')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('property-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Failed to upload images. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Generate AI description
  const handleGenerateDescription = async () => {
    const prompt = `Write a compelling property listing description for a ${formData.bedrooms} bedroom, ${formData.bathrooms} bathroom ${formData.unit_type} in ${formData.city}. 
    Features: ${Object.entries(formData.features)
      .filter(([_, value]) => value === true)
      .map(([key]) => key.replace(/_/g, ' '))
      .join(', ')}. 
    Rent: £${formData.rent_amount}/month. 
    Available: ${formData.available_date || 'Immediately'}.
    Make it appealing and highlight key features.`;

    // For now, provide a template. In production, this would call an AI service
    const template = `Beautiful ${formData.bedrooms} bedroom ${formData.unit_type} available in ${formData.city}. This well-maintained property features ${formData.bathrooms} bathroom${formData.bathrooms > 1 ? 's' : ''} and offers ${formData.square_footage ? formData.square_footage + ' sq ft of' : ''} comfortable living space.

${formData.features.has_parking ? '✓ Private parking included\n' : ''}${formData.features.has_garden_access ? '✓ Access to private garden\n' : ''}${formData.features.has_balcony ? '✓ Private balcony\n' : ''}${formData.features.has_lift ? '✓ Lift access\n' : ''}
The property is ${formData.features.furnished_status} and ${formData.features.pet_policy === 'allowed' ? 'pet-friendly' : formData.features.pet_policy === 'case_by_case' ? 'pets considered on a case-by-case basis' : 'no pets allowed'}.

Located in ${formData.city}, this property offers excellent transport links and local amenities. Perfect for professionals or small families looking for a quality home.

Available from ${formData.available_date ? format(new Date(formData.available_date), 'MMMM d, yyyy') : 'immediately'}. 
Rent: £${formData.rent_amount || 'TBC'} per month
Security Deposit: £${formData.security_deposit || formData.rent_amount || 'TBC'}

Contact us today to arrange a viewing!`;

    setFormData(prev => ({
      ...prev,
      listing_description: template
    }));
  };

  // Save property
  const handleSave = async () => {
    if (!user?.entityId) return;

    setSaving(true);
    try {
      const supabase = createClient();
      
      // Log the data being saved for debugging
      console.log('Saving property data:', {
        propertyId,
        formData,
        user: user?.entityId
      });

      // Update unit - start with core fields that definitely exist
      const updateData: any = {
        unit_identifier: formData.unit_identifier,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        rent_amount: formData.rent_amount || null,
        security_deposit: formData.security_deposit || null,
        available_date: formData.available_date || null,
        listing_status: formData.listing_status,
        listing_description: formData.listing_description || null,
        listing_created_at: formData.listing_status !== 'not_listed' ? new Date().toISOString() : null,
      };

      // Try to include new fields - they might not exist yet
      try {
        updateData.postcode = formData.postcode;
        updateData.unit_type = formData.unit_type;
        updateData.bedrooms = formData.bedrooms;
        updateData.bathrooms = formData.bathrooms;
        updateData.square_footage = formData.square_footage || null;
        updateData.images = formData.images;
        updateData.updated_at = new Date().toISOString();
      } catch (e) {
        console.warn('Some fields might not exist in database yet:', e);
      }

      const { error: unitError } = await supabase
        .from('units')
        .update(updateData)
        .eq('id', propertyId)
        .eq('landlord_id', user.entityId);

      if (unitError) {
        console.error('Unit update error:', unitError);
        throw unitError;
      }

      // Update or create unit attributes
      const { error: attrError } = await supabase
        .from('unit_attributes')
        .upsert({
          unit_id: propertyId,
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          square_footage: formData.square_footage || null,
          has_parking: formData.features.has_parking,
          has_garden_access: formData.features.has_garden_access,
          has_balcony: formData.features.has_balcony,
          has_lift: formData.features.has_lift,
          pet_policy: formData.features.pet_policy,
          furnished_status: formData.features.furnished_status,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'unit_id'
        });

      if (attrError) {
        console.error('Unit attributes error:', attrError);
        throw attrError;
      }

      // Refresh landlord data
      await fetchLandlordData(user.entityId);

      // Show success message
      alert('Property updated successfully!');
      
      // If listing status changed to public/private, redirect to properties
      if (formData.listing_status !== 'not_listed') {
        router.push('/landlord/properties');
      }
    } catch (error: any) {
      console.error('Error saving property:', error);
      const errorMessage = error?.message || 'Failed to save property. Please try again.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete property
  const handleDelete = async () => {
    if (!user?.entityId) return;

    setDeleting(true);
    try {
      await deleteUnit(propertyId);
      router.push('/landlord/properties');
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Failed to delete property. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/landlord/properties"
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Edit Property</h1>
            <p className="text-muted-foreground">{formData.unit_identifier || 'Property Details'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="listing">Listing</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Property Information</CardTitle>
              <CardDescription>Basic details about your property</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unit_identifier">Unit Identifier</Label>
                <Input
                  id="unit_identifier"
                  value={formData.unit_identifier}
                  onChange={(e) => handleChange('unit_identifier', e.target.value)}
                  placeholder="e.g., Flat 2A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_type">Property Type</Label>
                <Select
                  value={formData.unit_type}
                  onValueChange={(value) => handleChange('unit_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  min="0"
                  value={formData.bedrooms}
                  onChange={(e) => handleChange('bedrooms', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.bathrooms}
                  onChange={(e) => handleChange('bathrooms', parseFloat(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="square_footage">Square Footage (optional)</Label>
                <Input
                  id="square_footage"
                  type="number"
                  min="0"
                  value={formData.square_footage || ''}
                  onChange={(e) => handleChange('square_footage', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="e.g., 750"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rent_amount">Monthly Rent (£)</Label>
                <Input
                  id="rent_amount"
                  type="number"
                  min="0"
                  value={formData.rent_amount || ''}
                  onChange={(e) => handleChange('rent_amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g., 1500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="security_deposit">Security Deposit (£)</Label>
                <Input
                  id="security_deposit"
                  type="number"
                  min="0"
                  value={formData.security_deposit || ''}
                  onChange={(e) => handleChange('security_deposit', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="e.g., 1500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_date">Available Date</Label>
                <Input
                  id="available_date"
                  type="date"
                  value={formData.available_date || ''}
                  onChange={(e) => handleChange('available_date', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Property Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="London"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={formData.postcode}
                    onChange={(e) => handleChange('postcode', e.target.value)}
                    placeholder="SW1A 1AA"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    placeholder="UK"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Property Features</CardTitle>
              <CardDescription>Amenities and features of your property</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_parking">Parking Available</Label>
                  <Switch
                    id="has_parking"
                    checked={formData.features.has_parking}
                    onCheckedChange={(checked) => handleFeatureChange('has_parking', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="has_garden">Garden Access</Label>
                  <Switch
                    id="has_garden"
                    checked={formData.features.has_garden_access}
                    onCheckedChange={(checked) => handleFeatureChange('has_garden_access', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="has_balcony">Balcony</Label>
                  <Switch
                    id="has_balcony"
                    checked={formData.features.has_balcony}
                    onCheckedChange={(checked) => handleFeatureChange('has_balcony', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="has_lift">Lift Access</Label>
                  <Switch
                    id="has_lift"
                    checked={formData.features.has_lift}
                    onCheckedChange={(checked) => handleFeatureChange('has_lift', checked)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pet_policy">Pet Policy</Label>
                  <Select
                    value={formData.features.pet_policy}
                    onValueChange={(value) => handleFeatureChange('pet_policy', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allowed">Pets Allowed</SelectItem>
                      <SelectItem value="not_allowed">No Pets</SelectItem>
                      <SelectItem value="case_by_case">Case by Case</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="furnished_status">Furnishing</Label>
                  <Select
                    value={formData.features.furnished_status}
                    onValueChange={(value) => handleFeatureChange('furnished_status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="furnished">Fully Furnished</SelectItem>
                      <SelectItem value="partially_furnished">Partially Furnished</SelectItem>
                      <SelectItem value="unfurnished">Unfurnished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Listing Tab */}
        <TabsContent value="listing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Listing Settings</CardTitle>
              <CardDescription>Control how your property appears to tenants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="listing_status">Listing Status</Label>
                <Select
                  value={formData.listing_status}
                  onValueChange={(value: any) => handleChange('listing_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_listed">Not Listed</SelectItem>
                    <SelectItem value="public">Public - Visible to all tenants</SelectItem>
                    <SelectItem value="private">Private - Invite only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.listing_status !== 'not_listed' && (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {formData.listing_status === 'public' 
                        ? 'Your property will be visible on the public browse page for all tenants to see and apply.'
                        : 'Your property will only be visible to tenants you invite via email.'}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="listing_description">Property Description</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateDescription}
                      >
                        Generate with AI
                      </Button>
                    </div>
                    <Textarea
                      id="listing_description"
                      value={formData.listing_description || ''}
                      onChange={(e) => handleChange('listing_description', e.target.value)}
                      placeholder="Describe your property, highlighting its best features..."
                      className="min-h-[200px]"
                    />
                    <p className="text-sm text-muted-foreground">
                      A good description helps attract quality tenants
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Property Images</CardTitle>
              <CardDescription>Upload photos of your property (max 10 images)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    disabled={uploadingImage || formData.images.length >= 10}
                  >
                    {uploadingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Images
                      </>
                    )}
                  </Button>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                  <p className="text-sm text-muted-foreground">
                    {formData.images.length}/10 images uploaded
                  </p>
                </div>

                {/* Image Grid */}
                {formData.images.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image}
                          alt={`Property ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        {index === 0 && (
                          <Badge className="absolute bottom-2 left-2 bg-primary text-xs">
                            Main Photo
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                    <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No images uploaded yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add photos to make your listing more attractive
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this property? This action cannot be undone.
              All associated data including leases, applications, and documents will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Property'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}