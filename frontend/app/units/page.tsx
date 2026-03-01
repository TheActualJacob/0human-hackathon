'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Plus, Key, MapPin, Home, FileText, Wrench, AlertCircle, 
  CheckCircle, Clock, Filter, ChevronRight, Calendar, Shield,
  Zap, Flame, FileCheck, Building2 
} from 'lucide-react';
import useStore from '@/lib/store/useStore';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Unit, UnitWithDetails } from '@/types';

// ─── Form helpers ─────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 pb-2 border-b border-border/50">
      {children}
    </h3>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-4">{children}</div>;
}

function FormField({ label, children, hint, className }: {
  label: string; children: React.ReactNode; hint?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {hint && <p className="text-[11px] text-muted-foreground mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

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

// ─────────────────────────────────────────────────────────────────────────────
export default function UnitsPage() {
  const searchParams = useSearchParams();
  const landlordFilter = searchParams.get('landlord');
  
  const { 
    units,
    unitAttributes,
    unitStatus,
    unitDocuments,
    unitAppliances,
    leases,
    landlords,
    getUnitWithDetails,
    loading 
  } = useStore();

  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'appliances'>('details');
  const [addFormCountry, setAddFormCountry] = useState('');
  const [addFormSaving, setAddFormSaving] = useState(false);

  // Filter units by landlord if specified
  const filteredUnits = landlordFilter 
    ? units.filter(unit => unit.landlord_id === landlordFilter)
    : units;

  // Get landlord name for filter
  const filterLandlord = landlordFilter 
    ? landlords.find(l => l.id === landlordFilter)
    : null;

  // Get selected unit details
  const selectedUnitData = selectedUnit ? getUnitWithDetails(selectedUnit) : null;

  // Get occupancy status color
  const getOccupancyColor = (status?: string | null) => {
    switch (status) {
      case 'occupied': return 'bg-green-500/20 text-green-300';
      case 'vacant': return 'bg-gray-500/20 text-gray-300';
      case 'notice_given': return 'bg-yellow-500/20 text-yellow-300';
      case 'between_tenancies': return 'bg-blue-500/20 text-blue-300';
      case 'under_refurb': return 'bg-orange-500/20 text-orange-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  // Get document status icon
  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'gas_safety': return Flame;
      case 'epc': return Zap;
      case 'electrical_cert': return Shield;
      case 'fire_risk': return AlertCircle;
      default: return FileText;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading units...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Units</h1>
            <p className="text-muted-foreground">
              Manage properties, documents, and compliance
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Unit
          </button>
        </div>

        {/* Filter indicator */}
        {filterLandlord && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Showing units for:</span>
            <span className="font-medium">{filterLandlord.full_name}</span>
            <Link 
              href="/units" 
              className="text-primary hover:underline ml-2"
            >
              Clear filter
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Units Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              All Units ({filteredUnits.length})
            </h2>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>

          {filteredUnits.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No units found</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-primary hover:underline"
              >
                Add your first unit
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUnits.map((unit) => {
                const unitDetails = getUnitWithDetails(unit.id);
                const isSelected = selectedUnit === unit.id;

                return (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedUnit(unit.id)}
                    className={cn(
                      "bg-card border rounded-lg p-6 cursor-pointer transition-all",
                      isSelected 
                        ? "border-primary ai-glow" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">
                          {unit.unit_identifier}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[unit.city, unit.postcode, unit.country].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className={cn(
                        "text-xs font-medium px-2 py-1 rounded",
                        getOccupancyColor(unitDetails?.status?.occupancy_status)
                      )}>
                        {unitDetails?.status?.occupancy_status?.replace(/_/g, ' ') || 'Unknown'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      {unitDetails?.attributes && (
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">
                            {unitDetails.attributes.bedrooms || 0} bed
                          </span>
                          <span className="text-muted-foreground">
                            {unitDetails.attributes.bathrooms || 0} bath
                          </span>
                          {unitDetails.attributes.square_footage && (
                            <span className="text-muted-foreground">
                              {unitDetails.attributes.square_footage} sqft
                            </span>
                          )}
                        </div>
                      )}

                      {/* Document warnings */}
                      {unitDetails?.documents && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {unitDetails.documents
                            .filter(doc => doc.status === 'expired' || doc.status === 'expiring_soon')
                            .slice(0, 2)
                            .map(doc => (
                              <span
                                key={doc.id}
                                className={cn(
                                  "text-xs px-2 py-1 rounded flex items-center gap-1",
                                  doc.status === 'expired' 
                                    ? "bg-red-500/20 text-red-300"
                                    : "bg-yellow-500/20 text-yellow-300"
                                )}
                              >
                                <AlertCircle className="h-3 w-3" />
                                {doc.document_type.replace(/_/g, ' ')}
                              </span>
                            ))}
                        </div>
                      )}

                      {/* Maintenance indicators */}
                      {unitDetails?.status && (
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {unitDetails.status.has_open_maintenance && (
                            <span className="flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              {unitDetails.status.open_maintenance_count} active
                            </span>
                          )}
                          {unitDetails.status.has_chronic_issue && (
                            <span className="flex items-center gap-1 text-orange-400">
                              <AlertCircle className="h-3 w-3" />
                              {unitDetails.status.chronic_issue_count} chronic
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Unit Details Panel */}
        <div className="space-y-4">
          {selectedUnitData ? (
            <>
              {/* Unit Header */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {selectedUnitData.unit_identifier}
                  </h3>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {selectedUnitData.address}
                  </p>
                  <p className="text-muted-foreground">
                    {[selectedUnitData.city, selectedUnitData.postcode, selectedUnitData.country].filter(Boolean).join(', ')
                  </p>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">Landlord</p>
                    <p className="font-medium">
                      {landlords.find(l => l.id === selectedUnitData.landlord_id)?.full_name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-card border border-border rounded-lg">
                <div className="flex border-b border-border">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={cn(
                      "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                      activeTab === 'details' 
                        ? "border-b-2 border-primary text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={cn(
                      "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                      activeTab === 'documents' 
                        ? "border-b-2 border-primary text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Documents
                  </button>
                  <button
                    onClick={() => setActiveTab('appliances')}
                    className={cn(
                      "flex-1 px-4 py-3 text-sm font-medium transition-colors",
                      activeTab === 'appliances' 
                        ? "border-b-2 border-primary text-primary" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Appliances
                  </button>
                </div>

                <div className="p-6">
                  {/* Details Tab */}
                  {activeTab === 'details' && selectedUnitData.attributes && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Bedrooms</p>
                          <p className="font-medium">{selectedUnitData.attributes.bedrooms || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bathrooms</p>
                          <p className="font-medium">{selectedUnitData.attributes.bathrooms || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Square Footage</p>
                          <p className="font-medium">{selectedUnitData.attributes.square_footage || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Floor Level</p>
                          <p className="font-medium">{selectedUnitData.attributes.floor_level || 'Ground'}</p>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Features</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedUnitData.attributes.has_garden_access && (
                            <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Garden</span>
                          )}
                          {selectedUnitData.attributes.has_parking && (
                            <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Parking</span>
                          )}
                          {selectedUnitData.attributes.has_balcony && (
                            <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Balcony</span>
                          )}
                          {selectedUnitData.attributes.has_lift && (
                            <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">Lift</span>
                          )}
                        </div>
                      </div>
                      
                      {selectedUnitData.current_lease && (
                        <div className="pt-4 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Current Lease</p>
                          <Link 
                            href={`/leases/${selectedUnitData.current_lease.id}`}
                            className="text-primary hover:underline text-sm"
                          >
                            View lease details →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Documents Tab */}
                  {activeTab === 'documents' && (
                    <div className="space-y-3">
                      {selectedUnitData.documents?.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No documents uploaded
                        </p>
                      ) : (
                        selectedUnitData.documents?.map(doc => {
                          const Icon = getDocumentIcon(doc.document_type);
                          return (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 bg-accent/50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Icon className={cn(
                                  "h-5 w-5",
                                  doc.status === 'expired' ? "text-red-400" :
                                  doc.status === 'expiring_soon' ? "text-yellow-400" :
                                  "text-green-400"
                                )} />
                                <div>
                                  <p className="text-sm font-medium">
                                    {doc.document_type.replace(/_/g, ' ').toUpperCase()}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Expires: {doc.expiry_date ? format(new Date(doc.expiry_date), 'MMM d, yyyy') : 'N/A'}
                                  </p>
                                </div>
                              </div>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded",
                                doc.status === 'valid' ? "bg-green-500/20 text-green-300" :
                                doc.status === 'expiring_soon' ? "bg-yellow-500/20 text-yellow-300" :
                                "bg-red-500/20 text-red-300"
                              )}>
                                {doc.status?.replace(/_/g, ' ')}
                              </span>
                            </div>
                          );
                        })
                      )}
                      <button className="w-full mt-4 text-sm text-primary hover:underline">
                        Upload new document
                      </button>
                    </div>
                  )}

                  {/* Appliances Tab */}
                  {activeTab === 'appliances' && (
                    <div className="space-y-3">
                      {selectedUnitData.appliances?.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No appliances recorded
                        </p>
                      ) : (
                        selectedUnitData.appliances?.map(appliance => (
                          <div
                            key={appliance.id}
                            className="p-3 bg-accent/50 rounded-lg"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium">
                                {appliance.appliance_type.charAt(0).toUpperCase() + appliance.appliance_type.slice(1)}
                              </p>
                              <span className={cn(
                                "text-xs px-2 py-1 rounded",
                                appliance.condition === 'good' ? "bg-green-500/20 text-green-300" :
                                appliance.condition === 'fair' ? "bg-yellow-500/20 text-yellow-300" :
                                "bg-red-500/20 text-red-300"
                              )}>
                                {appliance.condition}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              {appliance.make && <p>Make: {appliance.make}</p>}
                              {appliance.model && <p>Model: {appliance.model}</p>}
                              {appliance.warranty_expiry && (
                                <p>Warranty: {format(new Date(appliance.warranty_expiry), 'MMM yyyy')}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                      <button className="w-full mt-4 text-sm text-primary hover:underline">
                        Add appliance
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Select a unit to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-card z-10">
              <div>
                <h2 className="text-lg font-semibold">Add New Property</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Fill in the full address and property details</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAddFormSaving(true);
                try {
                  const fd = new FormData(e.currentTarget);
                  const g = (k: string) => (fd.get(k) as string ?? '').trim();

                  const streetLine1 = g('street');
                  const streetLine2 = g('street2');
                  const fullAddress = streetLine2 ? `${streetLine1}, ${streetLine2}` : streetLine1;

                  const sqmRaw = parseFloat(g('sqm'));
                  const sqftRaw = parseFloat(g('sqft'));
                  // Prefer sqm input, convert to sqft for DB column; fall back to sqft direct
                  const squareFootage = !isNaN(sqmRaw) && sqmRaw > 0
                    ? Math.round(sqmRaw * 10.764)
                    : !isNaN(sqftRaw) && sqftRaw > 0 ? sqftRaw : null;

                  const countryCode = g('country');
                  const JURISDICTION_MAP: Record<string, string> = {
                    GB: 'england_wales', GR: 'greece', DE: 'germany', FR: 'france',
                    ES: 'spain', IT: 'italy', NL: 'netherlands', PT: 'portugal',
                    AT: 'austria', BE: 'belgium', IE: 'ireland', CY: 'cyprus',
                    PL: 'poland', CZ: 'czech_republic', HU: 'hungary', RO: 'romania',
                    US: 'united_states', CA: 'canada', AU: 'australia', AE: 'uae',
                    CH: 'switzerland', SE: 'sweden', DK: 'denmark', NO: 'norway', FI: 'finland',
                  };

                  await useStore.getState().addUnit({
                    landlord_id: g('landlord'),
                    unit_identifier: g('identifier'),
                    address: fullAddress,
                    city: g('city'),
                    postcode: g('postcode') || null,
                    country: countryCode || null,
                    jurisdiction: JURISDICTION_MAP[countryCode] ?? countryCode.toLowerCase() || null,
                    unit_type: g('unit_type') || null,
                    bedrooms: parseInt(g('bedrooms')) || null,
                    bathrooms: parseFloat(g('bathrooms')) || null,
                    square_footage: squareFootage,
                    rent_amount: parseFloat(g('rent_amount')) || null,
                    security_deposit: parseFloat(g('security_deposit')) || null,
                    available_date: g('available_date') || null,
                  });
                  setShowAddModal(false);
                  setAddFormCountry('');
                } finally {
                  setAddFormSaving(false);
                }
              }}
              className="px-6 py-5 space-y-7"
            >
              {/* ─── Ownership ──────────────────────────────────────────── */}
              <section>
                <SectionHeading>Ownership</SectionHeading>
                <FormRow>
                  <FormField label="Landlord *" className="col-span-2">
                    <select name="landlord" required className={inputCls}>
                      <option value="">Select landlord</option>
                      {landlords.map(l => (
                        <option key={l.id} value={l.id}>{l.full_name}</option>
                      ))}
                    </select>
                  </FormField>
                </FormRow>
              </section>

              {/* ─── Property identity ──────────────────────────────────── */}
              <section>
                <SectionHeading>Property Identity</SectionHeading>
                <FormRow>
                  <FormField label="Display Name *" className="col-span-2" hint='e.g. "Flat 3B", "Garden Studio", "Top Floor Apartment"'>
                    <input type="text" name="identifier" required placeholder="Flat 3B" className={inputCls} />
                  </FormField>
                  <FormField label="Property Type *">
                    <select name="unit_type" required className={inputCls}>
                      <option value="">Select type</option>
                      <option value="apartment">Apartment / Flat</option>
                      <option value="house">House</option>
                      <option value="studio">Studio</option>
                      <option value="room">Room</option>
                      <option value="townhouse">Townhouse</option>
                      <option value="villa">Villa</option>
                      <option value="maisonette">Maisonette</option>
                      <option value="bungalow">Bungalow</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>
                </FormRow>
              </section>

              {/* ─── Full address ────────────────────────────────────────── */}
              <section>
                <SectionHeading>Full Address</SectionHeading>
                <FormRow>
                  <FormField label="Street Address *" className="col-span-2" hint="House number and road name">
                    <input type="text" name="street" required placeholder="e.g. 12 Papagou Street" className={inputCls} />
                  </FormField>
                  <FormField label="Apt / Floor / Door (optional)" className="col-span-2" hint="Optional second line">
                    <input type="text" name="street2" placeholder="e.g. Floor 3, Door B" className={inputCls} />
                  </FormField>
                  <FormField label="City / Town *">
                    <input type="text" name="city" required placeholder="e.g. Athens" className={inputCls} />
                  </FormField>
                  <FormField label="State / Region" hint="Optional">
                    <input type="text" name="state" placeholder="e.g. Attica" className={inputCls} />
                  </FormField>
                  <FormField label="Postcode / ZIP *">
                    <input type="text" name="postcode" required placeholder="e.g. 15669" className={inputCls} />
                  </FormField>
                  <FormField label="Country *">
                    <select
                      name="country"
                      required
                      className={inputCls}
                      value={addFormCountry}
                      onChange={e => setAddFormCountry(e.target.value)}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </FormField>
                </FormRow>
              </section>

              {/* ─── Property details ────────────────────────────────────── */}
              <section>
                <SectionHeading>Property Details</SectionHeading>
                <FormRow>
                  <FormField label="Bedrooms *">
                    <select name="bedrooms" required className={inputCls}>
                      <option value="">Select</option>
                      <option value="0">Studio (0)</option>
                      <option value="1">1 bedroom</option>
                      <option value="2">2 bedrooms</option>
                      <option value="3">3 bedrooms</option>
                      <option value="4">4 bedrooms</option>
                      <option value="5">5 bedrooms</option>
                      <option value="6">6+ bedrooms</option>
                    </select>
                  </FormField>
                  <FormField label="Bathrooms *">
                    <select name="bathrooms" required className={inputCls}>
                      <option value="">Select</option>
                      <option value="1">1 bathroom</option>
                      <option value="1.5">1.5 bathrooms</option>
                      <option value="2">2 bathrooms</option>
                      <option value="2.5">2.5 bathrooms</option>
                      <option value="3">3 bathrooms</option>
                      <option value="4">4+ bathrooms</option>
                    </select>
                  </FormField>
                  <FormField label="Size in m²" hint="Leave blank if unknown">
                    <input type="number" name="sqm" min="5" max="2000" placeholder="e.g. 65" className={inputCls} />
                  </FormField>
                  <FormField label="Size in ft²" hint="Alternative to m²">
                    <input type="number" name="sqft" min="50" max="20000" placeholder="e.g. 700" className={inputCls} />
                  </FormField>
                </FormRow>
              </section>

              {/* ─── Listing & pricing ───────────────────────────────────── */}
              <section>
                <SectionHeading>Listing & Pricing</SectionHeading>
                <FormRow>
                  <FormField label="Monthly Rent *" hint={addFormCountry === 'GB' ? 'In GBP (£)' : addFormCountry === 'US' ? 'In USD ($)' : 'In local currency'}>
                    <input type="number" name="rent_amount" required min="0" step="0.01" placeholder="e.g. 850" className={inputCls} />
                  </FormField>
                  <FormField label="Security Deposit" hint="Optional — leave blank to skip">
                    <input type="number" name="security_deposit" min="0" step="0.01" placeholder="e.g. 1700" className={inputCls} />
                  </FormField>
                  <FormField label="Available From" hint="Leave blank if not yet known">
                    <input type="date" name="available_date" className={inputCls} />
                  </FormField>
                </FormRow>
              </section>

              {/* ─── Actions ─────────────────────────────────────────────── */}
              <div className="flex gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddFormCountry(''); }}
                  className="flex-1 px-4 py-2.5 border border-border rounded-lg hover:bg-accent transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFormSaving}
                  className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium"
                >
                  {addFormSaving ? 'Saving…' : 'Add Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}