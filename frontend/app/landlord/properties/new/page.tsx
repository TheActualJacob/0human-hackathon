'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Building2, MapPin, Home, Sparkles,
  Eye, Mail, Plus, X, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import useLandlordStore from '@/lib/store/landlord';
import { createPropertyInvite } from '@/lib/property/invites';
import { getCurrentUser } from '@/lib/auth/client';
import Link from 'next/link';

// ─── Country list ─────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' }, { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' }, { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' }, { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' }, { code: 'BR', name: 'Brazil' },
  { code: 'BG', name: 'Bulgaria' }, { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' }, { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' }, { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' }, { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' }, { code: 'EG', name: 'Egypt' },
  { code: 'EE', name: 'Estonia' }, { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' }, { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' }, { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong' }, { code: 'HU', name: 'Hungary' },
  { code: 'IN', name: 'India' }, { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' }, { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' }, { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' }, { code: 'KE', name: 'Kenya' },
  { code: 'LV', name: 'Latvia' }, { code: 'LB', name: 'Lebanon' },
  { code: 'LT', name: 'Lithuania' }, { code: 'LU', name: 'Luxembourg' },
  { code: 'MY', name: 'Malaysia' }, { code: 'MT', name: 'Malta' },
  { code: 'MX', name: 'Mexico' }, { code: 'MA', name: 'Morocco' },
  { code: 'NL', name: 'Netherlands' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' }, { code: 'NO', name: 'Norway' },
  { code: 'PK', name: 'Pakistan' }, { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' }, { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' }, { code: 'RO', name: 'Romania' },
  { code: 'SA', name: 'Saudi Arabia' }, { code: 'RS', name: 'Serbia' },
  { code: 'SG', name: 'Singapore' }, { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' }, { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' }, { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' }, { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' }, { code: 'TH', name: 'Thailand' },
  { code: 'TN', name: 'Tunisia' }, { code: 'TR', name: 'Turkey' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' }, { code: 'UA', name: 'Ukraine' },
  { code: 'VN', name: 'Vietnam' },
];

const JURISDICTION_MAP: Record<string, string> = {
  GB: 'england_wales', GR: 'greece', DE: 'germany', FR: 'france',
  ES: 'spain', IT: 'italy', NL: 'netherlands', PT: 'portugal',
  AT: 'austria', BE: 'belgium', IE: 'ireland', CY: 'cyprus',
  PL: 'poland', CZ: 'czech_republic', HU: 'hungary', RO: 'romania',
  US: 'united_states', CA: 'canada', AU: 'australia', AE: 'uae',
  CH: 'switzerland', SE: 'sweden', DK: 'denmark', NO: 'norway', FI: 'finland',
};

// Currency symbol per country code (falls back to local currency label)
const CURRENCY_MAP: Record<string, string> = {
  GB: '£', US: '$', CA: '$', AU: '$', NZ: '$', SG: '$', HK: '$',
  EU: '€',
  FR: '€', DE: '€', IT: '€', ES: '€', NL: '€', PT: '€', AT: '€',
  BE: '€', IE: '€', FI: '€', GR: '€', CY: '€', SK: '€', SI: '€',
  EE: '€', LV: '€', LT: '€', LU: '€', MT: '€',
  AE: 'AED', SA: 'SAR', IN: '₹', JP: '¥', CN: '¥', KR: '₩',
  TR: '₺', PL: 'zł', CZ: 'Kč', HU: 'Ft', RO: 'RON',
  CH: 'CHF', DK: 'kr', SE: 'kr', NO: 'kr',
};

function currencyFor(code: string) {
  return CURRENCY_MAP[code] ?? code;
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span>{children}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NewPropertyPage() {
  const router = useRouter();
  const { createUnit } = useLandlordStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');

  const [formData, setFormData] = useState({
    // Identity
    unit_identifier: '',
    unit_type: '',
    // Address
    street: '',
    street2: '',
    city: '',
    state: '',
    postcode: '',
    country: '',
    // Property details
    bedrooms: '',
    bathrooms: '',
    sqm: '',
    sqft: '',
    // Listing
    listing_status: 'not_listed' as 'not_listed' | 'public' | 'private',
    listing_description: '',
    rent_amount: '',
    security_deposit: '',
    available_date: new Date().toISOString().split('T')[0],
    // Features
    furnished_status: '',
    has_parking: false,
    has_garden_access: false,
    has_balcony: false,
  });

  const set = (patch: Partial<typeof formData>) => setFormData(prev => ({ ...prev, ...patch }));
  const currency = currencyFor(formData.country);

  // ─── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('You must be logged in');

      const fullAddress = formData.street2
        ? `${formData.street}, ${formData.street2}`
        : formData.street;

      // Prefer m² input; fall back to ft² direct
      const sqmVal  = parseFloat(formData.sqm);
      const sqftVal = parseFloat(formData.sqft);
      const squareFootage = !isNaN(sqmVal) && sqmVal > 0
        ? Math.round(sqmVal * 10.764)
        : !isNaN(sqftVal) && sqftVal > 0 ? sqftVal : null;

      const createdUnit = await createUnit({
        unit_identifier:    formData.unit_identifier,
        unit_type:          formData.unit_type || null,
        address:            fullAddress,
        city:               formData.city,
        postcode:           formData.postcode || null,
        country:            formData.country  || null,
        jurisdiction:       (JURISDICTION_MAP[formData.country] ?? formData.country.toLowerCase()) || null,
        bedrooms:           formData.bedrooms  ? parseInt(formData.bedrooms)    : null,
        bathrooms:          formData.bathrooms ? parseFloat(formData.bathrooms) : null,
        square_footage:     squareFootage,
        listing_status:     formData.listing_status,
        listing_description: formData.listing_description || null,
        rent_amount:        formData.rent_amount        ? parseFloat(formData.rent_amount)        : null,
        security_deposit:   formData.security_deposit   ? parseFloat(formData.security_deposit)   : null,
        available_date:     formData.available_date     || null,
        listing_created_at: formData.listing_status !== 'not_listed' ? new Date().toISOString() : null,
      } as any);

      // Private listing invites
      if (formData.listing_status === 'private' && inviteEmails.length > 0 && createdUnit?.id) {
        await Promise.all(inviteEmails.map(email =>
          createPropertyInvite({
            unitId: createdUnit.id,
            landlordId: user.entityId,
            email,
            message: `You've been invited to view ${formData.unit_identifier} at ${fullAddress}, ${formData.city}.`,
          })
        ));
      }

      router.push('/landlord/properties');
    } catch (err: any) {
      setError(err?.message || 'Failed to create property');
    } finally {
      setLoading(false);
    }
  };

  // ─── AI description generator ─────────────────────────────────────────────
  const generateDescription = async () => {
    if (!formData.bedrooms || !formData.street || !formData.rent_amount) {
      setError('Please fill in bedrooms, street address, and rent amount before generating');
      return;
    }
    setGeneratingDescription(true);
    setError(null);
    try {
      const features: string[] = [];
      if (formData.has_parking)      features.push('private parking');
      if (formData.has_garden_access) features.push('garden access');
      if (formData.has_balcony)       features.push('balcony');
      const bedsNum = parseInt(formData.bedrooms);
      const desc = `Beautiful ${bedsNum === 0 ? 'studio' : `${formData.bedrooms} bedroom`} property located in ${formData.city}${formData.state ? `, ${formData.state}` : ''}.

This ${formData.furnished_status || 'unfurnished'} ${formData.unit_type || 'property'} features ${bedsNum === 0 ? 'an open-plan studio layout' : `${formData.bedrooms} bedroom${bedsNum !== 1 ? 's' : ''}`} and ${formData.bathrooms || '1'} bathroom${parseFloat(formData.bathrooms || '1') !== 1 ? 's' : ''}.${features.length > 0 ? ` Additional features include ${features.join(', ')}.` : ''}

Located at ${formData.street}${formData.street2 ? `, ${formData.street2}` : ''}, ${formData.city}${formData.postcode ? ` ${formData.postcode}` : ''}, this property offers excellent transport links and local amenities.

Available from ${new Date(formData.available_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.

Monthly rent: ${currency}${formData.rent_amount}
Security deposit: ${currency}${formData.security_deposit || formData.rent_amount}

Contact us today to arrange a viewing.`;
      set({ listing_description: desc });
    } catch {
      setError('Failed to generate description');
    } finally {
      setGeneratingDescription(false);
    }
  };

  // ─── Preview mode ──────────────────────────────────────────────────────────
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
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{formData.unit_identifier}</CardTitle>
            <p className="text-muted-foreground">
              {[formData.street, formData.street2, formData.city, formData.postcode, formData.country]
                .filter(Boolean).join(', ')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">{currency}{formData.rent_amount}/month</div>
            <p className="whitespace-pre-wrap">{formData.listing_description}</p>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Available from {new Date(formData.available_date).toLocaleDateString()}</span>
              <span>Deposit: {currency}{formData.security_deposit}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <Button variant="ghost" asChild>
          <Link href="/landlord/properties">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to properties
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Property Identity ────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={Building2}>Property Identity</SectionTitle>
            </CardTitle>
            <CardDescription>Name and type of the property</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="unit_identifier">Display Name *</Label>
                <Input
                  id="unit_identifier"
                  required
                  placeholder='e.g. Flat 3B, Garden Studio'
                  value={formData.unit_identifier}
                  onChange={e => set({ unit_identifier: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">How this property appears across the platform</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_type">Property Type *</Label>
                <Select value={formData.unit_type} onValueChange={v => set({ unit_type: v })}>
                  <SelectTrigger id="unit_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="apartment">Apartment / Flat</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="villa">Villa</SelectItem>
                    <SelectItem value="maisonette">Maisonette</SelectItem>
                    <SelectItem value="bungalow">Bungalow</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Full Address ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={MapPin}>Full Address</SectionTitle>
            </CardTitle>
            <CardDescription>Complete property location — used for market analysis and listings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="street">Street Address *</Label>
              <Input
                id="street"
                required
                placeholder="e.g. 12 Artemidos Street"
                value={formData.street}
                onChange={e => set({ street: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">House/building number and road name</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="street2">Apartment / Floor / Door <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="street2"
                placeholder="e.g. Floor 3, Door B"
                value={formData.street2}
                onChange={e => set({ street2: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City / Town *</Label>
                <Input
                  id="city"
                  required
                  placeholder="e.g. Athens"
                  value={formData.city}
                  onChange={e => set({ city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State / Region <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="state"
                  placeholder="e.g. Attica"
                  value={formData.state}
                  onChange={e => set({ state: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode / ZIP *</Label>
                <Input
                  id="postcode"
                  required
                  placeholder="e.g. 15669"
                  value={formData.postcode}
                  onChange={e => set({ postcode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <select
                  id="country"
                  required
                  value={formData.country}
                  onChange={e => set({ country: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="">Select country</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Property Details ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={Home}>Property Details</SectionTitle>
            </CardTitle>
            <CardDescription>Physical characteristics of the property</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bedrooms *</Label>
                <Select value={formData.bedrooms} onValueChange={v => set({ bedrooms: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bedrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Studio (0)</SelectItem>
                    <SelectItem value="1">1 Bedroom</SelectItem>
                    <SelectItem value="2">2 Bedrooms</SelectItem>
                    <SelectItem value="3">3 Bedrooms</SelectItem>
                    <SelectItem value="4">4 Bedrooms</SelectItem>
                    <SelectItem value="5">5 Bedrooms</SelectItem>
                    <SelectItem value="6">6+ Bedrooms</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bathrooms *</Label>
                <Select value={formData.bathrooms} onValueChange={v => set({ bathrooms: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bathrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Bathroom</SelectItem>
                    <SelectItem value="1.5">1.5 Bathrooms</SelectItem>
                    <SelectItem value="2">2 Bathrooms</SelectItem>
                    <SelectItem value="2.5">2.5 Bathrooms</SelectItem>
                    <SelectItem value="3">3 Bathrooms</SelectItem>
                    <SelectItem value="4">4+ Bathrooms</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sqm">Size in m²</Label>
                <Input
                  id="sqm"
                  type="number"
                  min="5"
                  max="2000"
                  placeholder="e.g. 85"
                  value={formData.sqm}
                  onChange={e => set({ sqm: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Preferred — used for market analysis</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sqft">Size in ft²</Label>
                <Input
                  id="sqft"
                  type="number"
                  min="50"
                  max="20000"
                  placeholder="e.g. 915"
                  value={formData.sqft}
                  onChange={e => set({ sqft: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Alternative — only if you don't have m²</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Listing Options ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Listing Options</CardTitle>
            <CardDescription>Choose how you want to list this property</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Listing Type</Label>
              <Select
                value={formData.listing_status}
                onValueChange={(v: any) => set({ listing_status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_listed">
                    <div>
                      <div className="font-medium">Not Listed</div>
                      <div className="text-xs text-muted-foreground">Keep property private</div>
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
                      <div className="text-xs text-muted-foreground">Only via email invitation</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.listing_status === 'public' || formData.listing_status === 'private') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rent_amount">
                      Monthly Rent{currency ? ` (${currency})` : ''} *
                    </Label>
                    <Input
                      id="rent_amount"
                      type="number"
                      required
                      placeholder="e.g. 1500"
                      value={formData.rent_amount}
                      onChange={e => set({ rent_amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security_deposit">
                      Security Deposit{currency ? ` (${currency})` : ''}
                    </Label>
                    <Input
                      id="security_deposit"
                      type="number"
                      placeholder="e.g. 1500"
                      value={formData.security_deposit}
                      onChange={e => set({ security_deposit: e.target.value })}
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
                    onChange={e => set({ available_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Furnishing Status</Label>
                  <Select
                    value={formData.furnished_status}
                    onValueChange={v => set({ furnished_status: v })}
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
                    {[
                      { key: 'has_parking',      label: 'Parking Available' },
                      { key: 'has_garden_access', label: 'Garden Access' },
                      { key: 'has_balcony',       label: 'Balcony' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Switch
                          checked={formData[key as keyof typeof formData] as boolean}
                          onCheckedChange={checked => set({ [key]: checked } as any)}
                        />
                        <Label>{label}</Label>
                      </div>
                    ))}
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
                      {generatingDescription ? 'Generating…' : (
                        <><Sparkles className="h-4 w-4 mr-2" />AI Generate</>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    id="listing_description"
                    placeholder="Describe your property…"
                    rows={6}
                    value={formData.listing_description}
                    onChange={e => set({ listing_description: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Shown to prospective tenants</p>
                </div>

                {/* Private invite emails */}
                {formData.listing_status === 'private' && (
                  <div className="space-y-2">
                    <Label>Invite Specific Tenants</Label>
                    <p className="text-sm text-muted-foreground">
                      Add email addresses of tenants you want to invite
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="tenant@example.com"
                        value={currentEmail}
                        onChange={e => setCurrentEmail(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && currentEmail.includes('@')) {
                            e.preventDefault();
                            if (!inviteEmails.includes(currentEmail)) {
                              setInviteEmails(prev => [...prev, currentEmail]);
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
                            setInviteEmails(prev => [...prev, currentEmail]);
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
                        {inviteEmails.map((email, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-muted px-3 py-1 rounded-md">
                            <Mail className="h-3 w-3" />
                            <span className="flex-1">{email}</span>
                            <button
                              type="button"
                              onClick={() => setInviteEmails(prev => prev.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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

        <div className="flex gap-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'Creating Property…' : 'Create Property'}
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
