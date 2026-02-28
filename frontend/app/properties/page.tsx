'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Filter, MapPin, Bed, Bath, Calendar,
  Home, DollarSign, Shield
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';

type Unit = Database['public']['Tables']['units']['Row'];
type UnitAttributes = Database['public']['Tables']['unit_attributes']['Row'];

interface UnitWithAttributes extends Unit {
  unit_attributes?: UnitAttributes;
}

export default function PropertiesPage() {
  const [units, setUnits] = useState<UnitWithAttributes[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    minRent: '',
    maxRent: '',
    bedrooms: '',
    city: ''
  });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchPublicListings();
  }, []);

  const fetchPublicListings = async () => {
    setLoading(true);
    try {
      // Try fetching with listing_status filter first
      let query = supabase
        .from('units')
        .select(`
          *,
          unit_attributes (
            bedrooms,
            bathrooms,
            furnished_status,
            has_parking,
            has_garden_access
          )
        `)
        .order('created_at', { ascending: false });

      // Only filter by listing_status if we have the column
      const { data: raw, error } = await query;

      if (error) {
        console.error('Error fetching listings:', error.message);
        setFetchError(error.message);
        setUnits([]);
        setLoading(false);
        return;
      }
      setFetchError(null);

      // Filter to only public listings (handles both when column exists and when it doesn't)
      let data = (raw || []).filter((u: any) => 
        !u.listing_status || u.listing_status === 'public'
      );

      // Apply filters
      if (filters.minRent) {
        data = data.filter((u: any) => u.rent_amount && parseFloat(u.rent_amount) >= parseFloat(filters.minRent));
      }
      if (filters.maxRent) {
        data = data.filter((u: any) => u.rent_amount && parseFloat(u.rent_amount) <= parseFloat(filters.maxRent));
      }
      if (filters.city) {
        data = data.filter((u: any) => u.city?.toLowerCase().includes(filters.city.toLowerCase()));
      }

      // Apply client-side filters
      let filteredData = data || [];
      
      if (searchTerm) {
        filteredData = filteredData.filter(unit => 
          unit.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.unit_identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          unit.listing_description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      if (filters.bedrooms && filters.bedrooms !== 'any') {
        filteredData = filteredData.filter(unit => 
          unit.unit_attributes?.bedrooms === parseInt(filters.bedrooms) ||
          unit.bedrooms === parseInt(filters.bedrooms)
        );
      }

      setUnits(filteredData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchPublicListings();
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Immediately';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleViewDetails = (unitId: string) => {
    router.push(`/properties/${unitId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Find Your Next Home</h1>
          <p className="text-muted-foreground text-lg">Browse available properties</p>
        </div>
        
        {/* Loading Skeletons */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Find Your Next Home</h1>
        </div>
        <Card className="max-w-md mx-auto p-8">
          <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No listings available yet</h3>
          <p className="text-muted-foreground text-sm">
            Check back soon — landlords are setting up their properties.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Find Your Next Home</h1>
        <p className="text-muted-foreground text-lg">
          {units.length} properties available for rent
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by location, address, or description..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <label className="text-sm font-medium mb-1 block">Min Rent</label>
              <Input
                type="number"
                placeholder="£ Min"
                value={filters.minRent}
                onChange={(e) => setFilters({ ...filters, minRent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Max Rent</label>
              <Input
                type="number"
                placeholder="£ Max"
                value={filters.maxRent}
                onChange={(e) => setFilters({ ...filters, maxRent: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bedrooms</label>
              <Select
                value={filters.bedrooms}
                onValueChange={(value) => setFilters({ ...filters, bedrooms: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="0">Studio</SelectItem>
                  <SelectItem value="1">1 Bedroom</SelectItem>
                  <SelectItem value="2">2 Bedrooms</SelectItem>
                  <SelectItem value="3">3 Bedrooms</SelectItem>
                  <SelectItem value="4">4+ Bedrooms</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">City</label>
              <Input
                placeholder="Enter city"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Property Listings */}
      {units.length === 0 ? (
        <Card className="p-12 text-center">
          <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No properties found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search criteria to find more properties
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {units.map((unit) => (
            <Card key={unit.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {/* Property Image */}
              {unit.images && unit.images.length > 0 ? (
                <div className="h-48 relative overflow-hidden">
                  <img 
                    src={unit.images[0]} 
                    alt={unit.unit_identifier}
                    className="w-full h-full object-cover"
                  />
                  {unit.images.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                      +{unit.images.length - 1}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-48 bg-muted flex items-center justify-center">
                  <Home className="h-16 w-16 text-muted-foreground/20" />
                </div>
              )}

              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">
                    {unit.unit_identifier}
                  </CardTitle>
                  <Badge variant="default" className="text-lg px-3">
                    £{unit.rent_amount}/mo
                  </Badge>
                </div>
                <div className="flex items-center text-muted-foreground text-sm mt-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  {unit.address}, {unit.city}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Property Details */}
                <div className="flex gap-4 text-sm">
                  {unit.unit_attributes?.bedrooms != null && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>{unit.unit_attributes.bedrooms} bed</span>
                    </div>
                  )}
                  {unit.bedrooms != null && unit.unit_attributes == null && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-4 w-4 text-muted-foreground" />
                      <span>{unit.bedrooms} bed</span>
                    </div>
                  )}
                  {unit.unit_attributes?.bathrooms != null && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span>{unit.unit_attributes.bathrooms} bath</span>
                    </div>
                  )}
                  {unit.bathrooms != null && unit.unit_attributes == null && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-4 w-4 text-muted-foreground" />
                      <span>{unit.bathrooms} bath</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {unit.listing_description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {unit.listing_description}
                  </p>
                )}

                {/* Additional Features */}
                <div className="flex gap-2 flex-wrap">
                  {unit.unit_attributes?.furnished_status && (
                    <Badge variant="secondary" className="text-xs">
                      {unit.unit_attributes.furnished_status.replace('_', ' ')}
                    </Badge>
                  )}
                  {unit.unit_attributes?.has_parking && (
                    <Badge variant="secondary" className="text-xs">
                      Parking
                    </Badge>
                  )}
                  {unit.unit_attributes?.has_garden_access && (
                    <Badge variant="secondary" className="text-xs">
                      Garden
                    </Badge>
                  )}
                </div>

                {/* Availability */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Available from {formatDate(unit.available_date)}</span>
                </div>

                {/* Security Deposit */}
                {unit.security_deposit && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>£{unit.security_deposit} deposit</span>
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleViewDetails(unit.id)}
                >
                  View Details
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}