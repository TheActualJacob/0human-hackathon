'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, MapPin, Bed, Bath, Calendar, Home,
  DollarSign, Shield, Thermometer, Car, Trees,
  Sofa, Info, AlertCircle, Lock
} from 'lucide-react';
import Link from 'next/link';
import { validatePropertyInvite } from '@/lib/property/invites';
import type { Database } from '@/lib/supabase/database.types';

type Unit = Database['public']['Tables']['units']['Row'];
type UnitAttributes = Database['public']['Tables']['unit_attributes']['Row'];
type Landlord = Database['public']['Tables']['landlords']['Row'];

interface PropertyDetailsData extends Unit {
  unit_attributes?: UnitAttributes;
  landlords?: Landlord;
}

export default function PropertyDetailsPage() {
  const [property, setProperty] = useState<PropertyDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrivateListing, setIsPrivateListing] = useState(false);
  const [hasValidInvite, setHasValidInvite] = useState(false);
  const router = useRouter();
  const rawParams = useParams();
  const propertyId = rawParams?.id as string;
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const supabase = createClient();

  useEffect(() => {
    if (propertyId) fetchPropertyDetails();
  }, [propertyId, inviteToken]);

  const fetchPropertyDetails = async () => {
    try {
      // Check invite token for private listings
      if (inviteToken) {
        try {
          const inviteResult = await validatePropertyInvite(inviteToken);
          if (inviteResult.valid && inviteResult.unitId === propertyId) {
            setHasValidInvite(true);
          }
        } catch (e) {
          // Invite validation failed — continue as public viewer
        }
      }

      // Fetch property by ID only — no listing_status filter to avoid column-not-found errors
      const { data, error } = await supabase
        .from('units')
        .select(`
          *,
          unit_attributes (*),
          landlords (
            full_name,
            email
          )
        `)
        .eq('id', propertyId)
        .single();

      if (error) {
        console.error('Error fetching property:', error.message, error.code);
        if (error.code === 'PGRST116') {
          setError('Property not found');
        } else {
          setError(`Failed to load property details: ${error.message}`);
        }
        return;
      }

      if (!data) {
        setError('Property not found');
        return;
      }

      // Check listing status (if column exists)
      const status = (data as any).listing_status;
      if (status === 'private') {
        setIsPrivateListing(true);
        if (!hasValidInvite && !inviteToken) {
          setError('This is a private listing. You need an invitation to view it.');
          return;
        }
      } else if (status === 'not_listed') {
        setError('This property is not currently listed for viewing.');
        return;
      }

      setProperty(data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(`An unexpected error occurred: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Immediately';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const handleApply = async () => {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Redirect to signup with return URL
      router.push(`/auth/signup/tenant?returnUrl=/properties/${propertyId}`);
    } else {
      // Redirect to application form
      router.push(`/properties/${propertyId}/apply`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="grid gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link href="/properties">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to listings
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Property not found'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const attributes = property.unit_attributes;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/properties">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to listings
        </Link>
      </Button>

      {/* Property Image Gallery */}
      <Card className="mb-6 overflow-hidden">
        {property.images && property.images.length > 0 ? (
          <div className="relative h-96">
            <img 
              src={property.images[0]} 
              alt={property.unit_identifier}
              className="w-full h-full object-cover"
            />
            {property.images.length > 1 && (
              <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                +{property.images.length - 1} more photos
              </div>
            )}
          </div>
        ) : (
          <div className="h-96 bg-muted flex items-center justify-center">
            <Home className="h-24 w-24 text-muted-foreground/20" />
          </div>
        )}
      </Card>

      {/* Main Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Location */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                    {property.unit_identifier}
                    {isPrivateListing && (
                      <Badge variant="secondary" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Private Listing
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-1" />
                    {property.address}, {property.city}, {property.country}
                  </div>
                </div>
                {(property as any).rent_amount && (
                  <Badge variant="default" className="text-2xl px-4 py-2">
                    £{(property as any).rent_amount}/mo
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Description */}
          {(property as any).listing_description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{(property as any).listing_description}</p>
              </CardContent>
            </Card>
          )}

          {/* Property Details */}
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {(attributes?.bedrooms != null || (property as any).bedrooms != null) && (
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <span>{attributes?.bedrooms ?? (property as any).bedrooms} Bedroom{(attributes?.bedrooms ?? (property as any).bedrooms) !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {(attributes?.bathrooms != null || (property as any).bathrooms != null) && (
                  <div className="flex items-center gap-2">
                    <Bath className="h-4 w-4 text-muted-foreground" />
                    <span>{attributes?.bathrooms ?? (property as any).bathrooms} Bathroom{(attributes?.bathrooms ?? (property as any).bathrooms) !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {attributes?.furnished_status && (
                  <div className="flex items-center gap-2">
                    <Sofa className="h-4 w-4 text-muted-foreground" />
                    <span>{attributes.furnished_status.replace(/_/g, ' ')}</span>
                  </div>
                )}
                {attributes?.heating_type && (
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <span>{attributes.heating_type.replace(/_/g, ' ')} heating</span>
                  </div>
                )}
                {(attributes?.square_footage || (property as any).square_footage) && (
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span>{attributes?.square_footage ?? (property as any).square_footage} sq ft</span>
                  </div>
                )}
                {attributes?.floor_level != null && (
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span>Floor {attributes.floor_level}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Features & Amenities */}
          {attributes && (
            <Card>
              <CardHeader>
                <CardTitle>Features & Amenities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {attributes.has_parking && (
                    <Badge variant="secondary">
                      <Car className="h-3 w-3 mr-1" />
                      Parking Available
                    </Badge>
                  )}
                  {attributes.has_garden_access && (
                    <Badge variant="secondary">
                      <Trees className="h-3 w-3 mr-1" />
                      Garden Access
                    </Badge>
                  )}
                  {attributes.has_balcony && (
                    <Badge variant="secondary">Balcony</Badge>
                  )}
                  {attributes.has_lift && (
                    <Badge variant="secondary">Lift Access</Badge>
                  )}
                  {attributes.has_dishwasher && (
                    <Badge variant="secondary">Dishwasher</Badge>
                  )}
                  {attributes.has_washing_machine && (
                    <Badge variant="secondary">Washing Machine</Badge>
                  )}
                  {attributes.has_dryer && (
                    <Badge variant="secondary">Dryer</Badge>
                  )}
                  {attributes.has_ac && (
                    <Badge variant="secondary">Air Conditioning</Badge>
                  )}
                  {attributes.has_ensuite && (
                    <Badge variant="secondary">Ensuite</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Apply Card */}
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Ready to Apply?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(property as any).rent_amount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Rent</span>
                    <span className="font-semibold">£{(property as any).rent_amount}</span>
                  </div>
                )}
                {(property as any).security_deposit && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Security Deposit</span>
                    <span className="font-semibold">£{(property as any).security_deposit}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available From</span>
                  <span className="font-semibold">{formatDate((property as any).available_date ?? null)}</span>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Shield className="h-3 w-3" />
                    AI-powered screening
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Secure online payments
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleApply}
                >
                  Apply Now
                </Button>
                
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Free to apply • No hidden fees
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Landlord Info */}
          {property.landlords && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Listed By</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{property.landlords.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  Professional Landlord
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}