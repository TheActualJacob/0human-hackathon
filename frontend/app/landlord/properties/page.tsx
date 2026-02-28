'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Plus, Key, MapPin, Home, FileText, Wrench, AlertCircle, 
  CheckCircle, Clock, Filter, ChevronRight, Calendar, Shield,
  Zap, Flame, FileCheck, Building2, DollarSign 
} from 'lucide-react';
import useLandlordStore from '@/lib/store/landlord';
import useStore from '@/lib/store/useStore';
import useAuthStore from '@/lib/store/auth';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth/client';
import { createClient } from '@/lib/supabase/client';

export default function PropertiesPage() {
  const { 
    units,
    loading,
    createUnit,
    landlord,
    fetchLandlordData
  } = useLandlordStore();
  
  const { user } = useAuthStore();

  const {
    unitAttributes,
    unitStatus,
    unitDocuments,
    unitAppliances,
    getUnitWithDetails
  } = useStore();

  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'appliances'>('details');
  
  // Load landlord data on mount
  useEffect(() => {
    async function loadUserData() {
      if (!user) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          useAuthStore.getState().setUser(currentUser);
        }
      }
      
      if (user?.entityId && !landlord) {
        fetchLandlordData(user.entityId);
      }
    }
    
    loadUserData();
  }, [user, landlord, fetchLandlordData]);

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
          <div className="text-muted-foreground">Loading properties...</div>
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
            <h1 className="text-3xl font-semibold mb-2">Properties</h1>
            <p className="text-muted-foreground">
              Manage your properties, documents, and compliance
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Property
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Properties Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              All Properties ({units.length})
            </h2>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>

          {units.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No properties found</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-primary hover:underline"
              >
                Add your first property
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {units.map((unit) => {
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
                          {unit.unit_identifier || unit.name}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {unit.city || unit.address}
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
                            {unitDetails.attributes.bedrooms || unit.bedrooms || 0} bed
                          </span>
                          <span className="text-muted-foreground">
                            {unitDetails.attributes.bathrooms || unit.bathrooms || 0} bath
                          </span>
                          {(unitDetails.attributes.square_footage || unit.square_footage) && (
                            <span className="text-muted-foreground">
                              {unitDetails.attributes.square_footage || unit.square_footage} sqft
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

                      {/* Rent info if available */}
                      {unit.rent_amount && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          <span>${unit.rent_amount}/month</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Property Details Panel */}
        <div className="space-y-4">
          {selectedUnitData ? (
            <>
              {/* Property Header */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    {selectedUnitData.unit_identifier || selectedUnitData.name}
                  </h3>
                  <Link href={`/landlord/properties/${selectedUnitData.id}`}>
                    <ChevronRight className="h-5 w-5 text-muted-foreground hover:text-primary" />
                  </Link>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {selectedUnitData.address}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedUnitData.city}, {selectedUnitData.country || 'UK'}
                  </p>
                  {selectedUnitData.rent_amount && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">Monthly Rent</p>
                      <p className="font-medium">${selectedUnitData.rent_amount}</p>
                    </div>
                  )}
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
                  {activeTab === 'details' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Bedrooms</p>
                          <p className="font-medium">{selectedUnitData.bedrooms || selectedUnitData.attributes?.bedrooms || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Bathrooms</p>
                          <p className="font-medium">{selectedUnitData.bathrooms || selectedUnitData.attributes?.bathrooms || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Square Footage</p>
                          <p className="font-medium">{selectedUnitData.square_footage || selectedUnitData.attributes?.square_footage || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Unit Type</p>
                          <p className="font-medium capitalize">{selectedUnitData.unit_type || 'apartment'}</p>
                        </div>
                      </div>
                      
                      {selectedUnitData.attributes && (
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
                      )}
                      
                      {selectedUnitData.current_lease && (
                        <div className="pt-4 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Current Lease</p>
                          <Link 
                            href={`/landlord/leases/${selectedUnitData.current_lease.id}`}
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
                      {(!selectedUnitData.documents || selectedUnitData.documents.length === 0) ? (
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
                      {(!selectedUnitData.appliances || selectedUnitData.appliances.length === 0) ? (
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
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Select a property to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Property Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Add New Property</h2>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                
                try {
                  // The createUnit function now handles all the auth logic
                  await createUnit({
                    unit_identifier: formData.get('unit_identifier') as string,
                    address: formData.get('address') as string,
                    city: formData.get('city') as string,
                    country: formData.get('country') as string || 'UK',
                    jurisdiction: formData.get('jurisdiction') as string || 'england_wales'
                  });
                  
                  setShowAddModal(false);
                  // Reset form
                  (e.target as HTMLFormElement).reset();
                } catch (error) {
                  console.error('Full error object:', error);
                  const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
                  alert(errorMessage);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Unit Identifier *
                </label>
                <input
                  type="text"
                  name="unit_identifier"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Apartment 4A, Unit 101"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A unique name or number for this property unit
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Full Address *
                </label>
                <input
                  type="text"
                  name="address"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    required
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="London"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Country
                  </label>
                  <select
                    name="country"
                    defaultValue="UK"
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="UK">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="IE">Ireland</option>
                    <option value="NZ">New Zealand</option>
                    <option value="">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Jurisdiction
                </label>
                <select
                  name="jurisdiction"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select jurisdiction (optional)</option>
                  <option value="england">England</option>
                  <option value="wales">Wales</option>
                  <option value="scotland">Scotland</option>
                  <option value="northern_ireland">Northern Ireland</option>
                  <option value="california">California</option>
                  <option value="new_york">New York</option>
                  <option value="texas">Texas</option>
                  <option value="florida">Florida</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Legal jurisdiction for tenant-landlord laws
                </p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Note:</span> Additional property details like bedrooms, bathrooms, and rent amount can be added after creating the property.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}