'use client';

import { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Star, Phone, Mail, MapPin, 
  Calendar, CheckCircle, Clock, AlertCircle,
  DollarSign, Building
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useLandlordStore from '@/lib/store/landlord';
import useStore from '@/lib/store/useStore';
import { cn } from '@/lib/utils';

export default function LandlordContractorsPage() {
  const { 
    loading,
    fetchLandlordData
  } = useLandlordStore();

  const {
    vendors
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  useEffect(() => {
    fetchLandlordData();
  }, []);

  // Filter vendors
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.contact_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = filterSpecialty === 'all' || vendor.specialties?.includes(filterSpecialty);
    return matchesSearch && matchesSpecialty;
  });

  // Get specialty counts
  const specialtyCounts = vendors.reduce((acc, vendor) => {
    vendor.specialties?.forEach(specialty => {
      acc[specialty] = (acc[specialty] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-4 w-4",
          i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        )}
      />
    ));
  };

  const getAvailabilityBadge = (availability: string) => {
    switch (availability) {
      case 'immediate':
        return <Badge className="bg-green-500/10 text-green-500">Available Now</Badge>;
      case 'next_day':
        return <Badge className="bg-blue-500/10 text-blue-500">Next Day</Badge>;
      case 'scheduled':
        return <Badge className="bg-gray-500/10 text-gray-500">By Appointment</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading contractors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contractors</h1>
          <p className="text-muted-foreground">
            Trusted vendors for property maintenance
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contractor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{vendors.length}</p>
              <p className="text-sm text-muted-foreground">Total Contractors</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">
                {vendors.filter(v => v.is_available).length}
              </p>
              <p className="text-sm text-muted-foreground">Available Now</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Star className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">
                {vendors.filter(v => v.rating >= 4.5).length}
              </p>
              <p className="text-sm text-muted-foreground">Highly Rated</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">
                {vendors.filter(v => v.has_insurance).length}
              </p>
              <p className="text-sm text-muted-foreground">Insured</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search contractors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Specialties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Specialties</SelectItem>
            {Object.entries(specialtyCounts).map(([specialty, count]) => (
              <SelectItem key={specialty} value={specialty}>
                {specialty.charAt(0).toUpperCase() + specialty.slice(1)} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contractors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No contractors found</p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline">
              Add your first contractor
            </Button>
          </div>
        ) : (
          filteredVendors.map(vendor => (
            <Card 
              key={vendor.id}
              className="p-6 cursor-pointer hover:border-primary/50 transition-all"
              onClick={() => setSelectedVendor(vendor.id)}
            >
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg">{vendor.company_name}</h3>
                    {vendor.is_preferred && (
                      <Badge className="bg-primary/10 text-primary">Preferred</Badge>
                    )}
                  </div>
                  {vendor.contact_name && (
                    <p className="text-sm text-muted-foreground">{vendor.contact_name}</p>
                  )}
                </div>

                {/* Specialties */}
                <div className="flex flex-wrap gap-1">
                  {vendor.specialties?.map(specialty => (
                    <Badge key={specialty} variant="outline" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <div className="flex">{getRatingStars(vendor.rating)}</div>
                  <span className="text-sm text-muted-foreground">
                    {vendor.rating.toFixed(1)}
                  </span>
                </div>

                {/* Contact */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{vendor.phone_number}</span>
                  </div>
                  {vendor.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                  )}
                  {vendor.service_area && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{vendor.service_area}</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    {vendor.has_insurance && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Insured
                      </Badge>
                    )}
                    {vendor.has_license && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Licensed
                      </Badge>
                    )}
                  </div>
                  {getAvailabilityBadge(vendor.typical_availability)}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Vendor Detail Dialog */}
      {selectedVendor && (
        <Dialog open={!!selectedVendor} onOpenChange={() => setSelectedVendor(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {vendors.find(v => v.id === selectedVendor)?.company_name}
              </DialogTitle>
            </DialogHeader>
            {(() => {
              const vendor = vendors.find(v => v.id === selectedVendor);
              if (!vendor) return null;
              
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Person</p>
                      <p className="font-medium">{vendor.contact_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{vendor.phone_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{vendor.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Service Area</p>
                      <p className="font-medium">{vendor.service_area || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-2">
                      {vendor.specialties?.map(specialty => (
                        <Badge key={specialty} variant="secondary">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Credentials</p>
                    <div className="flex gap-2">
                      {vendor.has_insurance && (
                        <Badge className="bg-green-500/10 text-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Insured
                        </Badge>
                      )}
                      {vendor.has_license && (
                        <Badge className="bg-blue-500/10 text-blue-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Licensed
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Hourly Rates</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-secondary rounded">
                        <p className="text-xs text-muted-foreground">Standard</p>
                        <p className="font-semibold">£{vendor.hourly_rate_standard || 0}</p>
                      </div>
                      <div className="text-center p-3 bg-secondary rounded">
                        <p className="text-xs text-muted-foreground">Emergency</p>
                        <p className="font-semibold">£{vendor.hourly_rate_emergency || 0}</p>
                      </div>
                      <div className="text-center p-3 bg-secondary rounded">
                        <p className="text-xs text-muted-foreground">Weekend</p>
                        <p className="font-semibold">£{vendor.hourly_rate_weekend || 0}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedVendor(null)}>
                      Close
                    </Button>
                    <Button>
                      <Phone className="h-4 w-4 mr-2" />
                      Contact Vendor
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {/* Add Contractor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Contractor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input placeholder="ABC Plumbing Ltd" />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input placeholder="+44 7XXX XXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input type="email" placeholder="contact@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Primary Specialty</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="hvac">HVAC</SelectItem>
                  <SelectItem value="general">General Maintenance</SelectItem>
                  <SelectItem value="appliances">Appliances</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setShowAddDialog(false)}>
                Add Contractor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}